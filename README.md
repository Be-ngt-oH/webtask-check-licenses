Webtask-Check-Licenses
======================

This is a small webtask that allows you to automatically check if pull requests
introduce dependencies (in package.json) which do not have particular licenses.
For example, you could set it up to warn every time a package is added that is
not published under MIT license.

Prerequisites:

  * A GitHub token with repository access (https://github.com/settings/tokens)
  
  * `wt-cli` installed and set up (https://webtask.io/cli)

Create the webtask:

```
  $ wt create --secret GITHUB={your token here} check-license.js
  
  You can access your webtask at the following url:

  https://[...].sandbox.auth0-extend.com/webtask-check-licenses

```

Next, go to one of your repositories -> settings -> webhooks and enter the URL
of your webtask. Add the licenses you want to allow as a query parameter
`license`, e.g.

```https://[...].sandbox.auth0-extend.com/webtask-check-licenses?license=MIT&license=WTFPL```.

If you now open a new pull request, the webtask will be called. It will then
check if you have added or changed any `package.json` files, look for the
dependencies and fetch their licenses from the NPM registry
(https://skimdb.npmjs.com/). It then proceeds to compare them to the licenses
passed in the query string.

If one or more of the packages have unwanted licenses, the webtask will add a
failure status to the last commit of the pull request and add a comment listing
them.

Please note:

This webtask is merely a proof of concept and has several flaws.

**Do not seriously use this version.**

It is just supposed to be an example for using webtasks as GitHub-webhooks.
