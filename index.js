const url = require('url')

const denodeify = require('then-denodeify')

const Linkifier = require('noddity-linkifier')
const renderStatic = denodeify(require('noddity-render-static'))

const Ractive = require('ractive')
Ractive.DEBUG = false

const Koa = require('koa')
const Router = require('koa-router')
const compress = require('koa-compress')
const conditionalGet = require('koa-conditional-get')

require('ractive').DEBUG = false

const notFoundRegex = /Not Found/

module.exports = function({ butler, assetsUrl, indexHtml, nonMarkdownContentUrl, data = {} }) {
	const app = new Koa()
	const router = Router()

	const lazyRender = makeLazyRenderer({ butler, data, indexHtml })
	const getLastModified = makeLastModifiedWatcher({ butler })

	function setContentHeaders(context) {
		context.set('Cache-Control', 'public, must-revalidate')
		context.set('Last-Modified', getLastModified().toUTCString())
	}

	router.get('/', async (context, next) => {
		const file = 'index.md'

		setContentHeaders(context)

		if (context.stale) {
			const renderPromise = lazyRender({ file })

			await next()

			try {
				context.body = await renderPromise
			} catch (error) {
				await handleRenderError({ error, context, file })
			}
		}
	})

	router.get('/assets/:path(.+)', async (context, next) => {
		const { path } = context.params

		const redirectTo = url.resolve(assetsUrl, path)

		context.status = 301
		context.set('Location', redirectTo)
	})

	router.get(`/:path(.+\\.md)`, async (context, next) => {
		const { path } = context.params

		const file = decodeURIComponent(path)
		const query = context.query

		setContentHeaders(context, file)

		if (context.stale) {
			const renderPromise = lazyRender({
				file,
				sessionData: { parameters: query },
				key: context.search || '?'
			})

			await next()

			try {
				context.body = await renderPromise
			} catch (error) {
				await handleRenderError({ lazyRender, error, context, file })
			}
		}
	})

	router.get('/:path(.+\\.):extension(jpg|jpeg|gif|png)', async (context, next) => {
		const { path, extension } = context.params

		const redirectTo = url.resolve(nonMarkdownContentUrl, path + extension)

		context.status = 301
		context.set('Location', redirectTo)
	})

	app.use(async function notFoundPage(context, next) {
		await next()

		if (context.status === 404) {
			context.body = await lazyRender({
				file: '404.md',
				context
			})
		}
	})

	app.use(conditionalGet())
	app.use(compress())
	app.use(router.routes())

	return app
}

function makeLastModifiedWatcher({ butler }) {
	let lastModified = new Date()

	function resetLastModified() {
		lastModified = new Date()
	}

	butler.on('post changed', resetLastModified)
	butler.on('index changed', resetLastModified)

	return () => lastModified
}

function makeLazyRenderer({ butler, data, indexHtml }) {
	const linkifier = Linkifier('/')
	const template = Ractive.parse(indexHtml, { preserveWhitespace: true })
	const getPost = denodeify(butler.getPost)

	let renderedPosts = {}

	butler.on('index changed', () => renderedPosts = {})
	butler.on('post changed', (postname) => renderedPosts[postname] = {})

	return async function lazyRender({ key = '?', file, sessionData }) {
		if (!renderedPosts[file]) {
			renderedPosts[file] = {}
		}

		const postCache = renderedPosts[file]

		if (!postCache[key]) {
			const renderData = Object.assign({}, data, sessionData)

			const [ templatePost, postToRender ] = await Promise.all([
				getPost('post'),
				getPost(file)
			])

			const html = await renderStatic(templatePost, postToRender, {
				butler,
				linkifier,
				data: renderData,
			})

			const finalHtml = new Ractive({
				template,
				data: {
					html,
					metadata: postToRender.metadata
				}
			}).toHTML()

			postCache[key] = finalHtml
		}

		return postCache[key]
	}
}

async function handleRenderError({ lazyRender, error, context, file }) {
	const notFound = notFoundRegex.test(error.message)

	context.body = error.message

	if (notFound) {
		console.log('404 Not found:', file)
		context.status = 404
		if (lazyRender) {
			context.body = await lazyRender({
				file: '404.md',
				context
			})
		}
	} else {
		console.log(error)
		context.status = 500
	}
}
