function safeRequire(modulePath, fallbackModulePath) {
  let importedPackage;
  try {
    importedPackage = require(modulePath);
  } catch (e) {
    console.log('FAILED HERE', e.code);
    if (fallbackModulePath && e.code === 'MODULE_NOT_FOUND') {
      importedPackage = require(fallbackModulePath);
    }
  }
  return importedPackage;
}

module.exports = safeRequire;
