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

const app = require('./example')

app.listen(8888)
