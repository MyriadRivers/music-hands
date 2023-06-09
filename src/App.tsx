import * as Tone from 'tone';
import { useRef, useEffect } from 'react';
import {
  GestureRecognizer,
  PoseLandmarker,
  FilesetResolver,
  NormalizedLandmark,
  GestureRecognizerResult,
  PoseLandmarkerResult
} from '@mediapipe/tasks-vision'

import {
  LandmarkConnectionArray,
  drawConnectors,
  drawLandmarks
} from '@mediapipe/drawing_utils'

import {
  HAND_CONNECTIONS
} from '@mediapipe/hands'

import { getAngle, scale, radToDeg, clamp, getTimeSig } from './utils';

import kickSample from "./resources/kick.wav"
import snareSample from "./resources/snare.wav"
import hatOpenSample from "./resources/hihatOpen.wav"
import hatClosedSample from "./resources/hihatClosed.wav"
import shakeOpenSample from "./resources/shakerOpen.wav"
import shakeClosedSample from "./resources/shakerClosed.wav"

const POSE_CONNECT: LandmarkConnectionArray = PoseLandmarker.POSE_CONNECTIONS.map((connection) => [connection.start, connection.end]);

type Extensions = {
  thumb: number;
  index: number;
  middle: number;
  ring: number;
  pinky: number;
}

enum Mode {
  RHYTHM = "RHYTHM",
  MELODY = "MELODY"
}

enum Handedness {
  RIGHT = "RIGHT",
  LEFT = "LEFT"
}

var extMinR: Extensions = {
  thumb: 0.7,
  index: 0.7,
  middle: 0.7,
  ring: 0.7,
  pinky: 0.7
}

var extMinL: Extensions = {
  thumb: 0.7,
  index: 0.7,
  middle: 0.7,
  ring: 0.7,
  pinky: 0.7
}

var extMaxR: Extensions = {
  thumb: 0.7,
  index: 0.7,
  middle: 0.7,
  ring: 0.7,
  pinky: 0.7
}

var extMaxL: Extensions = {
  thumb: 0.7,
  index: 0.7,
  middle: 0.7,
  ring: 0.7,
  pinky: 0.7
};

function getFingerExtensions(handmarks: NormalizedLandmark[]): Extensions {
  let angleThumbMCP = radToDeg(getAngle(handmarks[1], handmarks[2], handmarks[3]));
  let angleThumbIP = radToDeg(getAngle(handmarks[2], handmarks[3], handmarks[4]));

  let angleIndexMCP = radToDeg(getAngle(handmarks[0], handmarks[5], handmarks[6]));
  let angleIndexPIP = radToDeg(getAngle(handmarks[5], handmarks[6], handmarks[7]));
  let angleIndexDIP = radToDeg(getAngle(handmarks[6], handmarks[7], handmarks[8]));

  let angleMiddleMCP = radToDeg(getAngle(handmarks[0], handmarks[9], handmarks[10]));
  let angleMiddlePIP = radToDeg(getAngle(handmarks[9], handmarks[10], handmarks[11]));
  let angleMiddleDIP = radToDeg(getAngle(handmarks[10], handmarks[11], handmarks[12]));

  let angleRingMCP = radToDeg(getAngle(handmarks[0], handmarks[13], handmarks[14]));
  let angleRingPIP = radToDeg(getAngle(handmarks[13], handmarks[14], handmarks[15]));
  let angleRingDIP = radToDeg(getAngle(handmarks[14], handmarks[15], handmarks[16]));

  let anglePinkyMCP = radToDeg(getAngle(handmarks[0], handmarks[17], handmarks[18]));
  let anglePinkyPIP = radToDeg(getAngle(handmarks[17], handmarks[18], handmarks[19]));
  let anglePinkyDIP = radToDeg(getAngle(handmarks[18], handmarks[19], handmarks[20]));

  let thumb = clamp((angleThumbMCP + angleThumbIP) / (180 * 2), 0, 1);
  let index = clamp((angleIndexMCP + angleIndexPIP + angleIndexDIP) / (180 * 3), 0, 1);
  let middle = clamp((angleMiddleMCP + angleMiddlePIP + angleMiddleDIP) / (180 * 3), 0, 1);
  let ring = clamp((angleRingMCP + angleRingPIP + angleRingDIP) / (180 * 3), 0, 1);
  let pinky = clamp((anglePinkyMCP + anglePinkyPIP + anglePinkyDIP) / (180 * 3), 0, 1);

  return {
    thumb: thumb,
    index: index,
    middle: middle,
    ring: ring,
    pinky: pinky
  }
}

function updateExtensionBoundaries(currExtR: Extensions | null, currExtL: Extensions | null) {
  if (currExtR) {
    extMinR.thumb = Math.min(extMinR.thumb, currExtR.thumb);
    extMinR.index = Math.min(extMinR.index, currExtR.index);
    extMinR.middle = Math.min(extMinR.middle, currExtR.middle);
    extMinR.ring = Math.min(extMinR.ring, currExtR.ring);
    extMinR.pinky = Math.min(extMinR.pinky, currExtR.pinky);

    extMaxR.thumb = Math.max(extMaxR.thumb, currExtR.thumb);
    extMaxR.index = Math.max(extMaxR.index, currExtR.index);
    extMaxR.middle = Math.max(extMaxR.middle, currExtR.middle);
    extMaxR.ring = Math.max(extMaxR.ring, currExtR.ring);
    extMaxR.pinky = Math.max(extMaxR.pinky, currExtR.pinky);
  }
  if (currExtL) {
    extMinL.thumb = Math.min(extMinL.thumb, currExtL.thumb);
    extMinL.index = Math.min(extMinL.index, currExtL.index);
    extMinL.middle = Math.min(extMinL.middle, currExtL.middle);
    extMinL.ring = Math.min(extMinL.ring, currExtL.ring);
    extMinL.pinky = Math.min(extMinL.pinky, currExtL.pinky);

    extMaxL.thumb = Math.max(extMaxL.thumb, currExtL.thumb);
    extMaxL.index = Math.max(extMaxL.index, currExtL.index);
    extMaxL.middle = Math.max(extMaxL.middle, currExtL.middle);
    extMaxL.ring = Math.max(extMaxL.ring, currExtL.ring);
    extMaxL.pinky = Math.max(extMaxL.pinky, currExtL.pinky);
  }
}

function getScaledExtension(ext: Extensions, hand: Handedness): Extensions {
  let extMin = hand === Handedness.RIGHT ? extMinR : extMinL;
  let extMax = hand === Handedness.RIGHT ? extMaxR : extMaxL;

  let scaledExt = {
    thumb: scale(ext.thumb, extMin.thumb, extMax.thumb, true),
    index: scale(ext.index, extMin.index, extMax.index, true),
    middle: scale(ext.middle, extMin.middle, extMax.middle, true),
    ring: scale(ext.ring, extMin.ring, extMax.ring, true),
    pinky: scale(ext.pinky, extMin.pinky, extMax.pinky, true),
  }

  return scaledExt;
}

function App() {
  // TODO: Consider refactoring these so instead of useRef they're just outside the function as normal variables
  // The "App()" componenent should be stand alone though, so I suppose maybe all those normal variables should be in the component instead of the other way around?

  // TODO: Maybe consider refactoring to split between first and second hands instead of right and left to make it handedness-agnostic
  // On second thought, might not work because the live tracking of min and max would get screwed up if it kept switching hands

  // Models
  const gestureRec = useRef<GestureRecognizer | null>(null);
  const poseLandmarker = useRef<PoseLandmarker | null>(null);

  // UI
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  // Samples
  const kick = useRef<Tone.Player | null>(null);
  const snare = useRef<Tone.Player | null>(null);

  const hatOpen = useRef<Tone.Player | null>(null);
  const hatClosed = useRef<Tone.Player | null>(null);
  const shakeOpen = useRef<Tone.Player | null>(null);
  const shakeClosed = useRef<Tone.Player | null>(null);

  // Instruments
  const oscT = useRef<Tone.Oscillator | null>(null);
  const oscI = useRef<Tone.Oscillator | null>(null);
  const oscM = useRef<Tone.Oscillator | null>(null);
  const oscR = useRef<Tone.Oscillator | null>(null);
  const oscP = useRef<Tone.Oscillator | null>(null);

  // Effects
  const filterT = useRef<Tone.Filter | null>(null);
  const filterI = useRef<Tone.Filter | null>(null);
  const filterM = useRef<Tone.Filter | null>(null);
  const filterR = useRef<Tone.Filter | null>(null);
  const filterP = useRef<Tone.Filter | null>(null);

  const panR = useRef<Tone.Panner | null>(null);
  const panL = useRef<Tone.Panner | null>(null);

  const masterGain = useRef<Tone.Gain | null>(null);

  // CONFIG
  const mode = useRef<Mode>(Mode.MELODY);
  const rhythmModeDone = useRef<boolean>(false);

  const ext1 = useRef<Extensions | null>(null);
  const ext2 = useRef<Extensions | null>(null);

  // Setting the BPM
  const counts = useRef<Array<boolean>>([false, false, false, false]);
  const countArray = useRef<Array<number>>([]);

  useEffect(() => {
    async function initialize() {
      await createGestureRecognizer();
      await createPoseLandmarker();
      await startWebCam();
      initSound();

    }
    initialize();
  }, []);

  const setBpm = () => {
    if (countArray.current.length > 0) {
      let difSum = 0;
      let prevTime = countArray.current[0];
      for (let i = 1; i < countArray.current.length; i++) {
        let dif = countArray.current[i] - prevTime;
        difSum += dif;
        prevTime = countArray.current[i]
      }

      let mspb = difSum / (countArray.current.length - 1)

      Tone.Transport.bpm.value = (1 / mspb) * 1000 * 60;
      Tone.Transport.timeSignature = getTimeSig(countArray.current.length);
      console.log("Setting bpm to: " + ((1 / mspb) * 1000 * 60) + "\nSetting time signature to: " + getTimeSig(countArray.current.length));
    }
  }

  const createGestureRecognizer = async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    gestureRec.current = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 2
    });
  }

  const createPoseLandmarker = async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    poseLandmarker.current = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numPoses: 2
    });
  }

  const initSound = () => {
    masterGain.current = new Tone.Gain(0);
    masterGain.current.toDestination();

    panL.current = new Tone.Panner(-1);
    panL.current.connect(masterGain.current);
    panR.current = new Tone.Panner(1);
    panR.current.connect(masterGain.current);

    kick.current = new Tone.Player(kickSample);
    kick.current.connect(masterGain.current);

    snare.current = new Tone.Player(snareSample);
    snare.current.connect(masterGain.current);

    hatOpen.current = new Tone.Player(hatOpenSample).connect(panR.current);
    hatOpen.current.volume.value = -9;
    hatClosed.current = new Tone.Player(hatClosedSample).connect(panR.current);

    shakeOpen.current = new Tone.Player(shakeOpenSample).connect(panL.current);
    shakeClosed.current = new Tone.Player(shakeClosedSample).connect(panL.current);

    oscT.current = new Tone.Oscillator("C4");
    oscI.current = new Tone.Oscillator("E4");
    oscM.current = new Tone.Oscillator("G4");
    oscR.current = new Tone.Oscillator("A#4");
    oscP.current = new Tone.Oscillator("D5");

    oscT.current.volume.value = -24;
    oscI.current.volume.value = -24;
    oscM.current.volume.value = -24;
    oscR.current.volume.value = -24;
    oscP.current.volume.value = -24;

    filterT.current = new Tone.Filter(0, "lowpass");
    filterI.current = new Tone.Filter(0, "lowpass");
    filterM.current = new Tone.Filter(0, "lowpass");
    filterR.current = new Tone.Filter(0, "lowpass");
    filterP.current = new Tone.Filter(0, "lowpass");

    oscT.current.connect(filterT.current);
    oscI.current.connect(filterI.current);
    oscM.current.connect(filterM.current);
    oscR.current.connect(filterR.current);
    oscP.current.connect(filterP.current);

    filterT.current.connect(masterGain.current);
    filterI.current.connect(masterGain.current);
    filterM.current.connect(masterGain.current);
    filterR.current.connect(masterGain.current);
    filterP.current.connect(masterGain.current);

    oscT.current.start();
    oscI.current.start();
    oscM.current.start();
    oscR.current.start();
    oscP.current.start();
  }

  const startWebCam = async () => {
    // Check if webcam access is supported.
    const hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

    // If webcam supported, add event listener to button for when user
    // wants to activate it.
    if (hasGetUserMedia()) {
      // set up webcam and gesture recognizer
      if (!gestureRec.current) {
        console.log("The model is still loading...")
        return;
      }

      const constraints = {
        video: true,
        audio: false
      };

      const mediaDevices = navigator.mediaDevices;
      const stream = await mediaDevices.getUserMedia(constraints);
      if (video.current) {
        video.current.srcObject = stream;
        video.current.play()
        video.current.addEventListener("loadedmetadata", predictWebcam);
      }
    } else {
      console.warn("getUserMedia() is not supported by your browser");
    }

    let lastVideoTime = -1;
    let handResults: GestureRecognizerResult;
    let poseResults: PoseLandmarkerResult;

    async function predictWebcam() {
      let startTimeMs = performance.now();
      if (video.current && gestureRec.current && poseLandmarker.current && canvas.current) {
        if (lastVideoTime !== video.current.currentTime) {
          lastVideoTime = video.current.currentTime;

          // Run the models on the current frame
          handResults = gestureRec.current.recognizeForVideo(video.current, startTimeMs);
          poseResults = poseLandmarker.current.detectForVideo(video.current, startTimeMs)

          const sonify = (handResults: GestureRecognizerResult, poseResults: PoseLandmarkerResult) => {
            if (oscT.current && oscI.current && oscM.current && oscR.current && oscP.current &&
              filterT.current && filterI.current && filterM.current && filterR.current && filterP.current &&
              masterGain.current) {

              // Only make sounds if hands are detected

              if (handResults.gestures.length > 0) {
                masterGain.current.gain.rampTo(1.0);

                // Derive parameters from the prediction results

                let extR: Extensions | null = null;
                let extL: Extensions | null = null;

                if (handResults.handednesses[0][0].categoryName === "Right") {
                  extR = getFingerExtensions(handResults.landmarks[0]);
                } else if (handResults.handednesses[0][0].categoryName === "Left") {
                  extL = getFingerExtensions(handResults.landmarks[0]);
                }

                if (handResults.handednesses.length > 1) {
                  if (handResults.handednesses[1][0].categoryName === "Right") {
                    extR = getFingerExtensions(handResults.landmarks[1]);
                  } else if (handResults.handednesses[1][0].categoryName === "Left") {
                    extL = getFingerExtensions(handResults.landmarks[1]);
                  }
                }

                updateExtensionBoundaries(extR, extL);

                let scaledExtR = extR;
                let scaledExtL = extL;
                if (extR) scaledExtR = getScaledExtension(extR, Handedness.RIGHT);
                if (extL) scaledExtL = getScaledExtension(extL, Handedness.LEFT);

                // React to gestures
                if (handResults.gestures[0][0].categoryName === "Closed_Fist" && mode.current !== Mode.RHYTHM) {
                  mode.current = Mode.RHYTHM;
                }

                if (mode.current === Mode.RHYTHM && kick.current && snare.current && !rhythmModeDone.current) {
                  ext1.current = handResults.handednesses[0][0].categoryName === "Right" ? scaledExtR : scaledExtL;
                  if (ext1.current) {
                    // Count fingers for bpm calculation based on their extensions
                    if (ext1.current.index > 0.85 && !counts.current[0]) {
                      console.log("1 at " + performance.now());
                      kick.current.start()
                      counts.current[0] = true;
                      countArray.current.push(performance.now());
                    }
                    if (ext1.current.middle > 0.85 && !counts.current[1]) {
                      console.log("2 at " + performance.now());
                      kick.current.start()
                      counts.current[1] = true;
                      countArray.current.push(performance.now());
                    }
                    if (ext1.current.ring > 0.85 && !counts.current[2]) {
                      console.log("3 at " + performance.now());
                      kick.current.start()
                      counts.current[2] = true;
                      countArray.current.push(performance.now());
                    }
                    if (ext1.current.pinky > 0.85 && !counts.current[3]) {
                      console.log("4 at " + performance.now());
                      kick.current.start()
                      counts.current[3] = true;
                      countArray.current.push(performance.now());
                    }
                    // Reset fingers if they go down, letting you continue the count past 4
                    if (ext1.current.index < 0.25 && counts.current[0]) {
                      counts.current[0] = false;
                    }
                    if (ext1.current.middle < 0.25 && counts.current[1]) {
                      counts.current[1] = false;
                    }
                    if (ext1.current.ring < 0.25 && counts.current[2]) {
                      counts.current[2] = false;
                    }
                    if (ext1.current.pinky < 0.25 && counts.current[3]) {
                      counts.current[3] = false;
                    }
                  }

                  if (mode.current === Mode.RHYTHM && handResults.gestures[0][0].categoryName === "Closed_Fist" && countArray.current.length > 1) {
                    mode.current = Mode.MELODY;
                    rhythmModeDone.current = true;
                    console.log("Kick it!")
                    setBpm();
                    startBeat();
                  }
                }

              } else {
                // gain.current.gain.rampTo(0.0);
              }
            }
          }

          sonify(handResults, poseResults);

        }
        canvas.current.width = video.current.videoWidth;
        canvas.current.height = video.current.videoHeight;

        let canvasCtx = canvas.current.getContext("2d");

        // Draw connectors and landmarks
        if (canvasCtx) {
          canvasCtx.save();
          canvasCtx.clearRect(0, 0, canvas.current.width, canvas.current.height);

          if (handResults.landmarks && poseResults.landmarks) {
            for (const landmarks of handResults.landmarks) {
              drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
                color: "#86cecb",
                lineWidth: 5
              });
              drawLandmarks(canvasCtx, landmarks, { color: "#d12f4e", lineWidth: 2 });
            }

            for (const landmark of poseResults.landmarks) {
              drawLandmarks(canvasCtx, landmark, { color: "#000000", lineWidth: 2 });
              drawConnectors(canvasCtx, landmark, POSE_CONNECT, {
                color: "#ffffff",
                lineWidth: 5
              });
            }
          }
          canvasCtx.restore();
        }
      }

      window.requestAnimationFrame(predictWebcam);
    }
  }

  const startBeat = () => {
    Tone.Transport.scheduleRepeat((time) => {
      kick.current?.start(time);
    }, "4n");
    Tone.Transport.scheduleRepeat((time) => {
      hatClosed.current?.start(time);
      shakeClosed.current?.start(time);
    }, "16n");
    if (Tone.Transport.timeSignature === 4) {
      Tone.Transport.scheduleRepeat((time) => {
        snare.current?.start(time);
      }, "2n", "4n");
      Tone.Transport.scheduleRepeat((time) => {
        hatOpen.current?.start(time, undefined, "16n");
        shakeOpen.current?.start(time, undefined, "16n");
      }, "4n", "8n");
    } else {
      Tone.Transport.scheduleRepeat((time) => {
        snare.current?.start(time);
      }, "2m", "1m");
    }
    Tone.Transport.start();
  }

  return (
    <div className="App">
      <div id="liveView" style={{ width: 500, height: 400, position: "relative" }}>
        <video id="video" ref={video} style={{ position: "absolute" }}></video>
        <canvas id="output_canvas" ref={canvas} style={{ position: "absolute", left: "0px", top: "0px" }}></canvas>
      </div>
    </div>
  );
}

export default App;
