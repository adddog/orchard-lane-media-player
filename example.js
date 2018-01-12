const ITAG = "133"
const IDS = ["3DC9Y2BqyuU", "R4-XIR7b-Qo"]
const ASSET_URL = "https://storage.googleapis.com/orchard-lane/"

import MediaSource from "./index"

MediaSource(IDS.map(id => `${ASSET_URL}${id}_${ITAG}.json`), {
  assetUrl: ASSET_URL,
}).then(
  ({ mediaSource, manifests, addFromReference }) => {
    document.body.appendChild(mediaSource.el)

    mediaSource.endingSignal.add(() => {})

    addFromReference(manifests[0], [0, 1])
  }
)

/*
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
document.body.appendChild(mediaSource.el)

Q.map(IDS, id =>
  xhr(`${ASSET_URL}${id}_${ITAG}.json`, {
    method: "GET",
    json: true,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  })
).then(d => {
  start(d)
})

function start(datas) {
  let _i = 0

  const getVo = () => {
    const r = 0 //_.random(0, IDS.length - 1, false)
    const id = IDS[r]
    const d = datas[r]
    console.log(r);
    const vo = VOUtils.voFromRef(
      _.assign({}, d, {
        url: `${ASSET_URL}${id}_${ITAG}`,
      }),
      [_i, _i + 2]
    )
    _i+=3
    return vo
  }

  mediaSource.endingSignal.add(() => {
    mediaSource.addVo(getVo())
  })

  mediaSource.addVo(getVo())
}

//videoEl.setAttribute("src", `${ASSET_URL}${IDS[0]}_${ITAG}_dashinit.mp4`)
*/
