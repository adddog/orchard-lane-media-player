import Signals from "signals"
import Q from "bluebird"

import Emitter from "./Emitter"
import CONST from "./constants"
import Loader from "./loader"

export default class NonDashMediaSource {
  constructor(options = {}) {
    let el = document.createElement("video")
    el.setAttribute("playsinline", "")
    el.setAttribute("webkit-playsinline", "")
    el.setAttribute("crossorigin", "anonymous")
    if (!options.paused) {
      el.setAttribute("autoplay", "true")
    }
    el.style.position = "fixed"
    el.style.top = "0"
    el.style.left = "0"
    el.style.zIndex = "999"
    //document.body.appendChild(el)
    this.options = options
    this.el = el
    this.timeCounter = 0

    this.readySignal = this.options.readySignal
    this.videoPlayingSignal = this.options.videoPlayingSignal
    this.videoStartedSignal = this.options.videoStartedSignal
    this.videoUpdateStartedSignal = this.options.videoUpdatedStartedSignal
    this.videoUpdateEndedSignal = this.options.videoUpdateEndedSignal
    this.segmentAddedSignal = this.options.segmentAddedSignal
    this.timeUpdateSignal = this.options.timeUpdateSignal
    this.endingSignal = this.options.endingSignal
    this.endedSignal = this.options.endedSignal

    this.videoElement = el

    this.onTimeUpdateBound = this._onTimeUpdate.bind(this)

    this.videoElement.addEventListener(
      "timeupdate",
      this.onTimeUpdateBound,
      false
    )
    this.videoElement.addEventListener(
      "ended",
      this._onVideoEnded,
      false
    )

    this.videoElement.addEventListener("playing", () => {
      this._waiting = false
      this.videoPlayingSignal.dispatch()
    })

    this.videoElement.addEventListener("waiting", () => {
      this._waiting = true
    })
    this.videoElement.addEventListener("pause", () => {
      this._waiting = true
    })

    this.videoElement.addEventListener("loadstart", () => {
      this._waiting = false
    })
    this._onInitClick = this._onInitClick.bind(this)
    window.addEventListener("touchend", this._onInitClick)
  }

  _onInitClick() {
    window.removeEventListener("touchend", this._onInitClick)
    this.videoElement.play()
  }

  ////-----------------
  //VIDEO HANDLERS
  ////-----------------

  pause() {
    this.videoElement.pause()
  }

  play() {
    this.videoElement.play()
  }

  _onVideoEnded(e) {}

  _onTimeUpdate() {
    this.timeCounter +=
      this.videoElement.currentTime - this.timeCounter
    this.timeUpdateSignal.dispatch(this.videoElement.currentTime)
    if (this.timeCounter > 5.12) {
      this.endingSignal.dispatch(this)
      this.timeCounter = 0
    }
  }

  get el() {
    return this.videoElement
  }

  set el(e) {
    this.videoElement = e
  }

  get isPaused() {
    return !this.videoElement.playing
  }

  set currentTime(t) {
    this.videoElement.currentTime = t
  }

  get waiting() {
    return this._waiting
  }

  addVo(currentVo, tearDown = false) {
    return new Q((resolve, reject) => {
      if (currentVo.nonDashUrl !== this.currentUrl) {
        this.videoElement.src = currentVo.nonDashUrl
      }
      this.currentUrl = currentVo.nonDashUrl
      resolve()
    })
  }
}
