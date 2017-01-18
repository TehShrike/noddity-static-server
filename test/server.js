require(`babel-polyfill`)
require(`babel-register`)({
	plugins: [
		`transform-async-to-generator`,
	]
})

const noddityStaticServer = require('../')

const Butler = require('noddity-butler')
const level = require('level-mem')

const indexHtml = require('fs').readFileSync('./index.html', { encoding: 'utf8' })

const contentUrl = 'https://content.kaysercommentary.com/'

noddityStaticServer({
	assetsUrl: 'https://assets.kaysercommentary.com/',
	nonMarkdownContentUrl: contentUrl,
	indexHtml,
	data: {
		title: 'Site name here',
		pathPrefix: '/',
		pagePathPrefix: '',
	},
	butler: Butler(contentUrl, level('server'), {
		refreshEvery: 1000 * 60 * 5,
		parallelPostRequests: 10
	})
}).listen(8888)
