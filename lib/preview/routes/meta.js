const hsServerState = {
  REMOTE_FS_IS_DIRTY: false
}

const buildMetaRouteHandler = (sessionInfo) => {
  return async (req, res) => {
    res.json(hsServerState);
    hsServerState["REMOTE_FS_IS_DIRTY"] = false;
  }
}

const markRemoteFsDirty = () => {
  hsServerState["REMOTE_FS_IS_DIRTY"] = true;
}

const remoteFsIsDirty = () => {
  return hsServerState["REMOTE_FS_IS_DIRTY"];
}

module.exports = {
  buildMetaRouteHandler,
  markRemoteFsDirty,
  remoteFsIsDirty
}
