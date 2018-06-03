const fetch = require('node-fetch')

module.exports = function (context, callback) {
  const NPM_REGISTRY_BASE_URL = 'https://skimdb.npmjs.com/registry'
  const GITHUB_API_SETTINGS = {
    headers: {
      'Authorization': `token ${context.secrets.GITHUB}`,
      'Content-Type': 'application/json'
    }
  }
  const ALLOWED_LICENSES = 'license' in context.query ? context.query.license : []

  async function main () {
    try {
      if (!context.body.pull_request || context.body.action !== 'opened') {
        return callback(null, 'Successfully done nothing!')
      }

      const pullRequestUrl = context.body.pull_request.url

      const filesList = await getFilesFromPullRequest(pullRequestUrl)
      const packageJsonUrls = filesList
        .filter(fileObject => fileObject.filename === 'package.json')
        .map(fileObject => fileObject.raw_url)

      packageJsonUrls.push(...packageJsonUrls)

      const incompatiblePackages = (
        await Promise.all(
          packageJsonUrls.map(url => findIncompatiblePackages(url))
        )
      ).reduce(
        (previousValue, currentValue) => Object.assign(previousValue, currentValue)
      )
      if (Object.keys(incompatiblePackages).length > 0) {
        await updatePullRequestStatus(pullRequestUrl, incompatiblePackages)
      }
    } catch (e) {
      return callback(e)
    }

    return callback(null, 'Success')
  }

  async function findIncompatiblePackages (packageJsonUrl) {
    const dependencies = await getDependencies(packageJsonUrl)
    const incompatiblePackages = {}

    for (const packageName in dependencies) {
      const license = await getLicense(packageName)
      if (!license || !ALLOWED_LICENSES.includes(license)) {
        incompatiblePackages[packageName] = license
      }
    }

    return incompatiblePackages
  }

  async function updatePullRequestStatus (pullRequestUrl, incompatiblePackages) {
    const pullRequest = await getPullRequest(pullRequestUrl)
    const statusesUrl = pullRequest.statuses_url
    const commentsUrl = pullRequest.comments_url

    // A status description has a limit of 140 characters, so we'll add a generic
    // status and list the unwanted packages in a separate comment.
    const description = 'This pull request adds dependencies with unwanted licenses.'
    await fetch(statusesUrl, {
      ...GITHUB_API_SETTINGS,
      method: 'POST',
      body: JSON.stringify({
        state: 'failure',
        description
      })
    })

    let message = `${description}\n\n`
    for (const [packageName, license] of Object.entries(incompatiblePackages)) {
      message = message.concat(
        `* Package ${packageName} has unwanted license ${license}.\n`
      )
    }
    message.concat(
      `\nThe only allowed licenses are ${ALLOWED_LICENSES}.`
    )

    await fetch(commentsUrl, {
      ...GITHUB_API_SETTINGS,
      method: 'POST',
      body: JSON.stringify({
        body: message
      })
    })
  }

  async function getFilesFromPullRequest (pullRequestUrl) {
    const response = await fetch(`${pullRequestUrl}/files`, GITHUB_API_SETTINGS)
    return response.json()
  }

  async function getPullRequest (pullRequestUrl) {
    const response = await fetch(pullRequestUrl, GITHUB_API_SETTINGS)
    return response.json()
  }

  async function getDependencies (packageJsonUrl) {
    const response = await fetch(packageJsonUrl)
    const json = await response.json()
    return 'dependencies' in json ? json.dependencies : []
  }

  async function getLicense (packageName) {
    const response = await fetch(`${NPM_REGISTRY_BASE_URL}/${packageName}`)
    const json = await response.json()
    return json.license
  }

  return main()
}
