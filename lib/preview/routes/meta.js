const hsServerState = {
  REMOTE_FS_IS_DIRTY: false
}

const buildMetaRouteHandler = (sessionInfo) => {
  return async (req, res) => {
    console.log(hsServerState)
    res.json(hsServerState);
    hsServerState["REMOTE_FS_IS_DIRTY"] = false;
  }
}

const markRemoteFsDirty = () => {
  hsServerState["REMOTE_FS_IS_DIRTY"] = true;
}

module.exports = {
  buildMetaRouteHandler,
  markRemoteFsDirty,
}
