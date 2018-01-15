import Q from "bluebird"
import Signals from "signals"
import MediaSource from "./mediasource"
import VOUtils from "./vo-utils"

const MediaPlayer = options => {
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
      Object.assign({}, data, {
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

window.OrchardLaneMediaPlayer = MediaPlayer

export default MediaPlayer
