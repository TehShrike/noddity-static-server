First: deploy your [Noddity content](http://noddity.com/#!/post/noddity-backend.md) to a static http server somewhere (think [now](https://zeit.co/now) or [surge](https://surge.sh/)).

Second: deploy any other assets (css, background images, logos) you want to reference to a static server (or the same one, if you like).

This module gives you a function that creates a server that will pull the markdown files from your content server and use them to generate static HTML on demand.

# Usage

The function exported by this server creates a new [koa-router](https://github.com/alexmingoia/koa-router) instance.

Example usage:

```js
const noddityStaticServer = require('noddity-static-server')
const makeLazyRenderer = require('noddity-lazy-static-render')

const Butler = require('noddity-butler')
const level = require('level-mem')

const indexHtml = require('fs').readFileSync('./index.html', { encoding: 'utf8' })

const contentUrl = 'https://content.yoursite.com/'

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
	assetsUrl: 'https://assets.yoursite.com/',
	nonMarkdownContentUrl: contentUrl,
	butler,
	lazyRender
})

const router = Router()
const app = new Koa()

router.use('', staticServerRouter.routes(), staticServerRouter.allowedMethods())

router.get('/custom', async function customPage(context, next) {
	context.body = 'This is a custom response, separate from the noddity-static-server routes!'
})

app.use(conditionalGet())
app.use(compress())

app.use(router.routes(), router.allowedMethods())

app.listen(8000)
```

This module is not very polished or extensible at the moment, lots of stuff is hardcoded.  I'm open to moving functionality out of this module and/or refactoring.  If you have any particular needs and want to help, open an issue.

Some things this module currently does:

- for any requests matching `/*.md`, fetches that file from the content server, renders it as HTML, and serves it up inside of the template `indexHtml`
- serves up `index.md` when you visit `/`
- returns 301 redirects to paths starting with the `assetsUrl` when a request comes to `/assets/*`
- for any requests matching `/*.(jpg|jpeg|gif|png)`, returns a 301 redirect to the same path at `nonMarkdownContentUrl`
- sets Last-Modified headers on page responses, using the last time when a post change was detected

# Node compatibility

This module uses async/await, so if you (like everyone else at time of publishing) aren't using Node 8 yet, you'll need to install these modules:

```sh
npm i babel-polyfill babel-register babel-plugin-transform-async-to-generator -S
```

and plop this at the top of your server file:

```js
require(`babel-polyfill`)
require(`babel-register`)({
	plugins: [
		`transform-async-to-generator`,
	],
	ignore: function(path) {
		// false => transpile with babel
		const nodeModules = /\/node_modules\//.test(path)

		if (nodeModules) {
			return !/\/noddity-static-server\//.test(path)
		}

		return false
	}
})
```

# License

[WTFPL](http://wtfpl2.com/)
