const noddityStaticServer = require('../')
const makeLazyRenderer = require('noddity-lazy-static-render')

const Butler = require('noddity-butler')
const level = require('level-mem')

const Koa = require('koa')
const Router = require('koa-router')
const compress = require('koa-compress')
const conditionalGet = require('koa-conditional-get')

const indexHtml = require('fs').readFileSync('./test/index.html', { encoding: 'utf8' })

const contentUrl = 'https://content.kaysercommentary.com/'

const butler = Butler(contentUrl, level('server'), {
	refreshEvery: 1000 * 60 * 5,
	parallelPostRequests: 10
})

const lazyRender = makeLazyRenderer({
	butler,
	data: {
		title: 'Site name here',
		pathPrefix: '/',
		pagePathPrefix: '',
	},
	indexHtml
})

const staticServerRouter = noddityStaticServer({
	assetsUrl: 'https://assets.kaysercommentary.com/',
	nonMarkdownContentUrl: contentUrl,
	butler,
	lazyRender
})

const router = Router()
const app = new Koa()

router.use('', staticServerRouter.routes(), staticServerRouter.allowedMethods())

router.get('/custom', function customPage(context, next) {
	context.body = 'This is a custom response, separate from the noddity-static-server routes!'

	return Promise.resolve()
})

app.use(conditionalGet())
app.use(compress())

app.use(router.routes(), router.allowedMethods())

app.listen(8888)
