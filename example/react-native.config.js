const path = require('path')
const pkg = require('../package.json')

/**
 * @type {import('@react-native-community/cli-types').Config}
 */
module.exports = {
    project: {
        ios: {
            // preios installs pods explicitly, using the installed CocoaPods CLI.
            // The RN automatic installer requires Bundler and system Ruby.
            automaticPodsInstallation: false,
        },
    },
    dependencies: {
        [pkg.name]: {
            root: path.join(__dirname, '..'),
        },
    },
}
