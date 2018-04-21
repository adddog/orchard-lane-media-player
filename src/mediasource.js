import Emitter from "./Emitter"

import CONST from "./constants"
const { ERROR_TYPES, BEHAVIORS } = CONST

import Loader from "./loader"
import Signals from "signals"
import Q from "bluebird"

const NO_MEDIASOURCE = true
const VERBOSE = true
const DEFAULT_CODECS = "avc1.640032"
const BUFFER_MARGIN = 4
const BUFFER_MARGIN_2 = 0.7

class VjMediaSource {
  constructor(options = {}) {
    let el = document.createElement("video")
    el.setAttribute("playsinline", "")
    el.setAttribute("webkit-playsinline", "")
    el.setAttribute("crossOrigin", "anonymous")
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
    //booleans
    this.updatedStarted, this.locked, (this.starting = true)

    //playback info
    this.segDuration = 0
    this.totalDuration = 0
    this.newVoStarted = false
    this.requestingNewVo = false
    this.playOffset = 0
    this.segmentIndex = 0
    this.totalSegments = 0
    this.paused = false
    this.ended = false
    this.currentCodec = ""
    this.skipCount = 0
    ////-----------------
    //SETUP
    ////-----------------
    this._currentVo
    this.mediaSource
    this.sourceBuffer
    this._effects
    this.currentVideoId

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

    this.onBufferUpdateStartBound = this.onBufferUpdateStart.bind(
      this
    )
    this.onBufferUpdateEndBound = this.onBufferUpdateEnd.bind(this)
    //this.onInitAddedBound = this._onInitAdded.bind(this);
    this.onTimeUpdateBound = this._onTimeUpdate.bind(this)
    this.onBufferSourceRemovedBound = this._onBufferSourceRemoved.bind(
      this
    )
    this.onSourceOpenBound = this._onSourceOpen.bind(this)
    this.onSourceErrorBound = this._onSourceError.bind(this)

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
    this.videoElement.addEventListener("loadeddata", () => {
      if (VERBOSE) {
        console.log("Loaded data")
      }
    })

    this.videoElement.addEventListener("playing", () => {
      if (VERBOSE) {
        console.log("Playing")
      }
      this._waiting = false
      this.videoPlayingSignal.dispatch()
    })

    this.videoElement.addEventListener("waiting", () => {
      if (VERBOSE) {
        console.log("Waiting")
      }
      this._waiting = true
    })
    this.videoElement.addEventListener("pause", () => {
      if (VERBOSE) {
        console.log("Pause")
      }
      this._waiting = true
    })

    this.videoElement.addEventListener("loadstart", () => {
      if (VERBOSE) {
        console.log("loadstart")
      }
      this._waiting = false
      //this.videoPlayingSignal.dispatch()
    })

    if (window.MediaSource) {
      this._newMediaSource()
    }
    this.waitingLine = []
  }

  _newMediaSource() {
    return new Promise((yes, no) => {
      this.starting = true
      this.mediaSource = new window.MediaSource()
      let url = URL.createObjectURL(this.mediaSource)
      this.videoElement.src = url
      this.mediaSource.addEventListener("error", () => {
        no()
        this.onSourceErrorBound()
      })
      this.mediaSource.addEventListener("sourceopen", () => {
        if (VERBOSE) {
          console.log("_newMediaSource sourceopen")
        }
        yes(this.onSourceOpenBound())
      })
    })
  }

  _onSourceError(e) {}

  _onSourceOpen(e) {
    this.starting = false
    this.readySignal.dispatch(this)
    Emitter.emit("mediasource:ready", this)
    if (this.waitingLine.length) {
      const currentVo = this.waitingLine.pop()
      return this.newBufferSouce(currentVo.codecs).then(() => {
        if (VERBOSE) {
          console.log("_onSourceOpen newBufferSouce")
        }
        return this._readyToAdd(currentVo)
      })
    }
    return true
  }

  newBufferSouce(codecs) {
    return new Q((resolve, reject) => {
      this._removeSourceBuffer().then(() => {
        // setTimeout(() => {
        this.mediaSource.removeEventListener(
          "sourceopen",
          this.onSourceOpenBound
        )
        this.currentCodec = codecs || this.currentCodec

        this.sourceBuffer = this.mediaSource.addSourceBuffer(
          `video/mp4; codecs="${this.currentCodec}"`
        )
        this.sourceBuffer.addEventListener(
          "updatestart",
          this.onBufferUpdateStartBound
        )

        this.sourceBuffer.addEventListener(
          "updateend",
          this.onBufferUpdateEndBound
        )

        if (VERBOSE) {
          console.log(`newBufferSouce ${this.currentCodec}`)
        }

        resolve()
        //}, 2000)
      })
    })
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

  _onVideoEnded(e) {
    if (VERBOSE) {
      console.warn("Video Ended")
    }
  }

  _onTimeUpdate() {
    let ct = this.videoElement.currentTime
    if (ct > this.currentVo.startTime && !this.newVoStarted) {
      this.newVoStarted = true
      this.videoStartedSignal.dispatch(this.currentVo)
      Emitter.emit("mediasource:videostarting", this)
    }
    //console.log(ct, this.totalDuration);
    if (ct >= this.totalDuration - BUFFER_MARGIN) {
      if (!this.requestingNewVo && this._canUpdate()) {
        this.requestingNewVo = true
        if (VERBOSE) {
          console.log(this.currentVo.videoId, "Requesting new vo")
        }
        this.endingSignal.dispatch(this)
        Emitter.emit("mediasource:ending", this)
      }
    }
    if (ct >= this.totalDuration - 0.1) {
      if (!this.ended) {
        this.ended = true
        this.endedSignal.dispatch(this)
        Emitter.emit("mediasource:ended", this)
      }
    }
    this.timeUpdateSignal.dispatch(ct)
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

  ////-----------------
  //API
  ////-----------------

  stepBack(amount = 0) {
    let _target = this.videoElement.currentTime - amount
    this.videoElement.currentTime = _target
    if (VERBOSE) {
      console.log("back", _target)
    }
  }

  stepForward(amount = 0) {
    let _target = this.videoElement.currentTime + amount
    if (_target > this.totalDuration) {
      _target = this.totalDuration - BUFFER_MARGIN
    }
    if (VERBOSE) {
      console.log("forward", _target)
    }
    this.videoElement.currentTime = _target
  }

  setPlaybackRate(rate) {
    this.videoElement.playbackRate = rate
  }

  getReadyState() {
    return this.mediaSource.readyState
  }

  setCurrentVideoId(id) {
    this.currentVideoId = id
  }

  getCurrentVideoId(id) {
    return this.currentVideoId
  }

  addVo(currentVo, tearDown = false) {
    return new Q((resolve, reject) => {

      if (this._addingSegment) {
        return resolve()
      }

      this._addingSegment = true

      if (VERBOSE) {
        console.log(
          "CurrentCodec: ",
          this.currentCodec,
          "new codec:",
          currentVo.codecs
        )
      }

      this._currentVo = currentVo

      if (!this.currentCodec) {
        if (VERBOSE) {
          console.log("init")
        }
        Emitter.emit("audio:warn", `The codecs arnt equal`)
        if (!this._canUpdate()) {
          this.waitingLine.push(currentVo)
          return resolve()
        }
      } else if (tearDown) {
        console.log("resetMediasource")
        this.resetMediasource().then(() =>
          this.newBufferSouce(currentVo.codecs).then(() =>
            this._readyToAdd(currentVo)
          )
        )
      } else {
        if (this.sourceBuffer) {
          if (VERBOSE) {
            Emitter.emit(
              "audio:log",
              `Sourcebuffer updating: ${this.sourceBuffer.updating}`
            )
            Emitter.emit(
              "audio:log",
              `Sourcebuffer mode: ${this.sourceBuffer.mode}`
            )
          }
          resolve(this._readyToAdd(currentVo))
        } else {
          Emitter.emit("audio:warn", `The codecs arnt equal`)
          //return this._readyToAdd(currentVo);
        }
      }
    })
  }

  _readyToAdd(currentVo) {
    this.setCurrentVideoId(currentVo.id)
    // this.mediaSource.duration = this.totalDuration
    return this._addSegment(currentVo)
  }

  _onBufferSourceRemoved() {}

  ////-----------------
  //BUFFER HANDLERS
  ////-----------------

  onBufferUpdateStart() {
    this.updatedStarted = true
    this.requestingNewVo = false
    this.ended = false
    if (VERBOSE) {
      console.log("onBufferUpdateStart")
    }
    Emitter.emit("mediasource:updatestart", this)
  }

  onBufferUpdateEnd() {
    this.updatedStarted = false
    Emitter.emit("mediasource:updateend", this)
    if (VERBOSE) {
      Emitter.emit(
        "audio:log",
        `Sourcebuffer updated. Is updating: ${
          this.sourceBuffer.updating
        }`
      )
    }
  }

  _addSegment(currentVo) {
    this.newVoStarted = false
    this.currentVo = currentVo
    this.currentVo.startTime = this.totalDuration
    this.totalDuration += this.currentVo.duration

    let off = 0
    let videoId = this.currentVo.videoId
    if (this.sourceBuffer.buffered.length > 0) {
      off = this.sourceBuffer.buffered.end(
        this.sourceBuffer.buffered.length - 1
      )
    }

    return this._trySettingOffset(this.currentVo, off).then(() => {
      return Loader.indexRange(this.currentVo).then(initResp => {
        return this._addInitReponse(this.currentVo, initResp).then(
          () => {
            off =
              this.sourceBuffer.timestampOffset -
              this.currentVo["timestampOffset"]
            return this._trySettingOffset(this.currentVo, off).then(
              () => {
                return Loader.range(this.currentVo).then(
                  rangeData => {
                    return this._addResponse(
                      this.currentVo,
                      rangeData
                    ).then(() => {
                      this._addingSegment = false
                      return {
                        totalDuration: this.totalDuration,
                        duration: this.currentVo.duration,
                      }
                    })
                  }
                )
              }
            )
          }
        )
      })
    })
  }

  _trySettingOffset(vo, off) {
    return new Q((resolve, reject) => {
      let _i,
        _self = this

      resolve()
      return

      function _poll() {
        if (!_self.sourceBuffer.updating) {
          clearInterval(_i)
          Emitter.emit(
            "audio:log",
            `Sourcebuffer mode: ${_self.sourceBuffer.mode}`
          )
          try {
            _self.sourceBuffer.timestampOffset = off || 0
            if (VERBOSE) {
              console.log(`timestampOffset is: ${off}`)
            }
            resolve()
          } catch (e) {
            console.error(
              `Error _trySettingOffset of: ${off}... ${e.toString()}`
            )
            resolve()
            //reject(new Error(`${ERROR_TYPES.FATAL}:${vo.videoId}`))
          }
        } else {
          if (VERBOSE) {
            console.log(`source buffer updating...`)
          }
        }
      }
      _i = this._getInterval(_poll)
    })
  }

  _addInitReponse(vo, initResp) {
    return new Q((resolve, reject) => {
      let _self = this

      function _onInitAdded() {
        _self.sourceBuffer.removeEventListener(
          "updateend",
          _onInitAdded
        )
        if (VERBOSE) {
          console.log("Init response added: ", vo.videoId || vo.id)
        }
        resolve()
      }

      function _tryAppend() {
        try {
          _self.sourceBuffer.appendBuffer(initResp)
        } catch (e) {
          //_self.newBufferSouce().then(_tryAppend).finally()
          reject(
            new Error(`${ERROR_TYPES.RECOVER}:${vo.videoId || vo.id}`)
          )
        }
      }
      if (this._canUpdate()) {
        this.sourceBuffer.removeEventListener(
          "updatestart",
          this.onBufferUpdateStartBound
        )
        this.sourceBuffer.removeEventListener(
          "updateend",
          this.onBufferUpdateEndBound
        )
        this.sourceBuffer.addEventListener("updateend", _onInitAdded)
        _tryAppend()
      } else {
        console.log(`Cannot update init!`)
      }
    })
  }

  _addResponse(vo, resp) {
    return new Q((resolve, reject) => {
      let _self = this

      if (VERBOSE) {
        console.log(
          `Got video response. Soundbuffer updating: ${
            this.sourceBuffer.updating
          }`
        )
      }

      function _onResponseAdded() {
        _self.sourceBuffer.removeEventListener(
          "updateend",
          _onResponseAdded
        )
        _self.onBufferUpdateEndBound()
        resolve()
      }

      if (this._canUpdate() && this.sourceBuffer) {
        this.sourceBuffer.addEventListener(
          "updateend",
          _onResponseAdded
        )
        this.sourceBuffer.addEventListener(
          "updatestart",
          this.onBufferUpdateStartBound
        )
        try {
          this.sourceBuffer.appendBuffer(resp)
          if (vo.seekValue) {
            let _t = this.videoElement.currentTime + vo.seekValue
            //this.videoElement.currentTime = _t
          }
          if (VERBOSE) {
            console.log(
              "Added segment: ",
              vo.id,
              "Total duration:",
              this.totalDuration
            )
          }
          this.segmentAddedSignal.dispatch()
        } catch (e) {
          /*
        DOMException: Failed to execute 'appendBuffer' on 'SourceBuffer': The HTMLMediaElement.error attribute is not null.(…)
            */
          console.error(e.name)
          console.error(e)
        }
        //reject(new Error(`${ERROR_TYPES.RECOVER}:${vo.videoId}`))
      } else {
        console.log(`Cannot update video!`)
      }
    })
  }

  _getInterval(func, dur = 100) {
    return setInterval(func, 100)
  }

  //crash

  _canUpdate() {
    return (
      this.mediaSource &&
      this.mediaSource.readyState === "open" &&
      this.sourceBuffer &&
      !this.sourceBuffer.updating
    )
  }

  _removeSourceBuffer() {
    return new Q((resolve, reject) => {
      if (this.sourceBuffer) {
        this.sourceBuffer.removeEventListener(
          "updateend",
          this.onBufferUpdateEndBound
        )
        this.sourceBuffer.removeEventListener(
          "updatestart",
          this.onBufferUpdateStartBound
        )
        this.sourceBuffer.abort()
        try {
          this.sourceBuffer.remove(0, Infinity)
        } catch (e) {
          console.error(e)
        }
        this.mediaSource.removeSourceBuffer(this.sourceBuffer)
        this.sourceBuffer = null
        if (VERBOSE) {
          console.log(`_removeSourceBuffer success`)
        }
        resolve()
      } else {
        resolve()
      }
    })
  }

  resetMediasource() {
    if (this.starting || !this.mediaSource) {
      return
    }
    if (VERBOSE) {
      console.warn("Reset buffer source")
    }
    return this._removeSourceBuffer().then(() => {
      this.mediaSource.removeEventListener(
        "error",
        this.onSourceErrorBound
      )
      this.mediaSource.removeEventListener(
        "sourceopen",
        this.onSourceOpenBound
      )
      this.mediaSource.endOfStream()
      this.mediaSource = null
      this.sourceBuffer = null
      this.requestingNewVo = false
      this.enterFrameCounter = 0
      this.videoElement.currentTime = 0
      this.totalDuration = this.segDuration = this.playOffset = 0
      //this.waitingLine.push(this.currentVo)
      if (VERBOSE) {
        console.warn("MediaSource removed")
      }
      return this._newMediaSource()
    })
  }
}

export default VjMediaSource
