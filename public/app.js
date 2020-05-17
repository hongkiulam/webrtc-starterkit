/*
 Thanks to https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling
 ... and https://tsh.io/blog/how-to-write-video-chat-app-using-webrtc-and-nodejs/
*/

/****************************************************************************
 * Initial setup
 ****************************************************************************/

// get nickName
let nickName = prompt("Enter Nickname");
while (nickName == "") {
  nickName = prompt("Enter Nickname");
}
// const configuration = {
//   iceServers: [
//     {
//       urls: 'stun:stun.l.google.com:19302', // Google's public STUN server
//     },
//   ],
// };

// callback functions for convenience
const onSuccess = () => {};
const onError = (error) => {
  console.error(error);
};

// get media permissions on page load
(async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  stream.getTracks().forEach((track) => {
    track.stop();
  });
})();

/****************************************************************************
 * Signalling server
 ****************************************************************************/

//connect to socket
const socket = io();
let otherUser;
let isAlreadyCalling = false;

socket.emit("join", nickName);
// show connected members
socket.on("newMember", (members) => {
  const userList = document.getElementById("userList");
  userList.innerHTML = "";
  members.forEach((member) => {
    const { nickName, socketId } = member;
    const item = document.createElement("span");
    item.appendChild(document.createTextNode(nickName));
    const callButton = document.createElement("button");
    callButton.textContent = "Call";
    callButton.dataset.nickName = nickName;
    callButton.dataset.socketId = socketId;
    callButton.addEventListener("click", invite);
    item.appendChild(callButton);
    userList.appendChild(item);
  });
});

// signal events
const makeOffer = (to, offer) => {
  socket.emit("makeOffer", {
    to,
    offer,
  });
};
const makeAnswer = (to, answer) => {
  socket.emit("makeAnswer", {
    to,
    answer,
  });
};
// signal listeners
// receive offer from offerer
socket.on("receiveOffer", async ({ offer, from }) => {
  otherUser = from;
  await createPeerConnection();
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(new RTCSessionDescription(answer));
  makeAnswer(from, answer);
});

socket.on("receiveAnswer", async ({ answer, from }) => {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
  if (!isAlreadyCalling) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(new RTCSessionDescription(offer));
    makeOffer(from, offer);
    isAlreadyCalling = true;
  }
});

socket.on("closeVideoCall", () => {
  closeVideoCall();
});

/****************************************************************************
 * WebRTC Setup
 ****************************************************************************/

//declare peerConnection globally
let pc;
let localStream;
/**
 * Establish RTCPeerConnection
 */
const createPeerConnection = async () => {
  pc = new RTCPeerConnection();

  // set remote video
  pc.ontrack = ({ streams: [stream] }) => {
    const remoteVideo = document.getElementById("remoteVideo");
    if (remoteVideo) {
      remoteVideo.srcObject = stream;
    }
    // allow hangup when remote video connected
    document.getElementById("hangup-button").disabled = false;
  };

  // get user video and audio
  const localVideo = document.getElementById("localVideo");
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    if (localVideo) {
      localVideo.srcObject = localStream;
    }
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  } catch (e) {
    handleUserMediaError(e);
  }
};

/**
 * Handles error if client can't get video or audio
 */
const handleUserMediaError = (e) => {
  switch (e.name) {
    case "NotFoundError":
      alert(
        "Unable to open your call because no camera and/or microphone" +
          "were found."
      );
      break;
    case "SecurityError":
    case "PermissionDeniedError":
      // Do nothing; this is the same as the user canceling the call.
      break;
    default:
      alert("Error opening your camera and/or microphone: " + e.message);
      break;
  }
};

/**
 * Make offer to start connection
 */
const invite = async (e) => {
  if (nickName == e.target.dataset.nickName) {
    return alert(`Can't call yourself!`);
  }
  if (pc) {
    return alert("Already Connected");
  }
  await createPeerConnection();
  const offer = await pc.createOffer();
  await pc.setLocalDescription(new RTCSessionDescription(offer));
  makeOffer(e.target.dataset.socketId, offer);
  otherUser = e.target.dataset.socketId;
};

// hangup logic
document.getElementById("hangup-button").addEventListener("click", (e) => {
  e.preventDefault();
  socket.emit("closeVideoCall", otherUser);
  closeVideoCall();
});

const closeVideoCall = () => {
  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");
  if (remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach((track) => track.stop());
  }
  if (localVideo.srcObject) {
    localVideo.srcObject.getTracks().forEach((track) => track.stop());
  }
  remoteVideo.removeAttribute("src");
  remoteVideo.removeAttribute("srcObject");
  localVideo.removeAttribute("src");
  remoteVideo.removeAttribute("srcObject");

  document.getElementById("hangup-button").disabled = true;
  pc = null;
  localStream = null;
  isAlreadyCalling = false;
};
