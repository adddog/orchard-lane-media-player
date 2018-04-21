import Q from "bluebird"
import Signals from "signals"
import MediaSource from "./mediasource"
import NonDashMediaSource from "./non-dash-mediasource"
import VOUtils from "./vo-utils"

const MediaPlayer = options => {
  const useDash =  window.MediaSource && !options.forceNonDash
  const mediaSource =
    useDash
      ? new MediaSource({
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
      : new NonDashMediaSource({
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

  const addFromReference = (data, referenceRange, tearDown) => {
    const vo = useDash ? VOUtils.voFromRef(data, referenceRange) : data
    mediaSource.addVo(vo, tearDown)
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
