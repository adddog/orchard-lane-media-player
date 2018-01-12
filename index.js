import { assign } from "lodash"
import Q from "bluebird"
import Signals from "signals"
import Xhr from "xhr-request"
import MediaSource from "./src/mediasource"
import VOUtils from "./src/vo-utils"

const xhr = Q.promisify(Xhr)
//const xhr = Q.promisify(Get)

export default options => {
  const mediaSource = new MediaSource({
    readySignal: new Signals(),
    videoStartedSignal: new Signals(),
    videoUpdateStartedSignal: new Signals(),
    videoUpdateEndedSignal: new Signals(),
    videoPlayingSignal: new Signals(),
    videoPausedSignal: new Signals(),
    videoWaitingSignal: new Signals(),
    segmentAddedSignal: new Signals(),
    timeUpdateSignal: new Signals(),
    endingSignal: new Signals(),
    endedSignal: new Signals(),
  })

  const ASSET_URL = options.assetUrl || ""

  const addFromReference = (data, referenceRange) => {
    const vo = VOUtils.voFromRef(
      assign({}, data, {
        url: `${ASSET_URL}${data.videoId}_${data.itag}`,
      }),
      referenceRange
    )

    mediaSource.addVo(vo)
    return vo
  }

  return {
    VOUtils,
    mediaSource: mediaSource,
    addFromReference: addFromReference,
  }

}
