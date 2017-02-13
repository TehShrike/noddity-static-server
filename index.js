const url = require('url')

const Router = require('koa-router')

require('ractive').DEBUG = false

const notFoundRegex = /Not Found/

module.exports = function({ butler, assetsUrl, lazyRender, nonMarkdownContentUrl }) {
	const router = Router()
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

	return router
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


async function handleRenderError({ error, context, file }) {
	const notFound = notFoundRegex.test(error.message)

	context.body = error.message

	if (notFound) {
		console.log('404 Not found:', file)
		context.status = 404
	} else {
		console.log(error)
		context.status = 500
	}
}
