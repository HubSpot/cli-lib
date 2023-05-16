Publishing Releases
===================

If you've modified `cli-lib`, you'll have to create a new release for it and may also need to update the `cli-lib` dependancy in `hubspot-cli`.
1. Check out the `main` branch.
2. Determine which version you need to increment for your changes per [semantic versioning](https://semver.org/) and run the corresponding release command in cli-lib.
  * For bug fixes run `npm run release:patch`
  * For non-breaking new features, run `npm run release:minor`
  * For breaking changes, run `npm run release:major`
3. If you updated the major version (i.e. made breaking changes), you’ll also need to bump the `cli-lib` dependency version in `hubspot-cli` publish a new release to see those changes reflected. Use the `^` operator with the major version so that new minor and patch versions of `cli-lib` are automatically applied (i.e. `^5.0.0`)
