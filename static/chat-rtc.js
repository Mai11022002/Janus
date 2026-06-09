import { currentRecipientId } from './chat-ui.js';

let localStream = null;
let peerConnection = null;
let socketInstance = null;
let targetCallerId = null;

const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

export function initWebRTC(socket) {
    socketInstance = socket;
    document.getElementById('hangup-btn').onclick = endCall;
    socketInstance.on('incoming_call', handleIncomingCall);
    socketInstance.on('receive_signaling', handleSignalingData);
    socketInstance.on('remote_call_ended', handleRemoteHangup);
}

// ─── Caller: initiate the call ───
export async function startWebRTCCall(type) {
    if (!currentRecipientId) return;
    targetCallerId = currentRecipientId;

    const callerName = document.getElementById('current-user-display')?.textContent || 'User';
    showCallUI(`Calling ${document.querySelector('.chat-details h3').innerText}...`);

    try {        
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true
            },
            video: type === 'video' ? { facingMode: "user" } : false
        };

        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        document.getElementById('local-video').srcObject = localStream;

        setupPeerConnection();

        // Caller creates the offer first
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        socketInstance.emit('call_request', {
            target_id: targetCallerId,
            sender_username: callerName,
            type: type
        });

        // Send the offer immediately after call_request
        socketInstance.emit('signaling_signal', {
            target_id: targetCallerId,
            signal: { sdp: peerConnection.localDescription }
        });

    } catch (err) {
        console.error("Failed to acquire media:", err);
        alert("Could not access microphone/camera. Please check permissions.");
        endCall();
    }
}

// ─── Callee: receive the call ───
async function handleIncomingCall(data) {
    if (localStream) return;

    const accept = confirm(`Incoming ${data.type} call from ${data.sender_username}. Accept?`);
    targetCallerId = data.sender_id;

    if (!accept) {
        socketInstance.emit('call_ended', { target_id: targetCallerId });
        return;
    }

    showCallUI(`Connected with ${data.sender_username}`);

    try {
        const constraints = {
            audio: {
                echoCancellation: true,
                noiseSuppression: true
            },
            video: data.type === 'video' ? { facingMode: "user" } : false
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        document.getElementById('local-video').srcObject = localStream;

        setupPeerConnection();
        // Callee waits for the offer via receive_signaling before creating answer

    } catch (err) {
        console.error("Error accepting call:", err);
        endCall();
    }
}

// ─── Shared: setup peer connection ───
function setupPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById('remote-video');
        if (!remoteVideo.srcObject) {
            remoteVideo.srcObject = event.streams[0];
        }
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socketInstance.emit('signaling_signal', {
                target_id: targetCallerId,
                signal: { candidate: event.candidate }
            });
        }
    };

    peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log('Connection state:', state);
        if (state === 'connected') {
            document.getElementById('call-status-title').innerText = 'Connected';
        } else if (state === 'disconnected' || state === 'failed') {
            endCall();
        }
    };
}

// ─── Process SDP and ICE candidates ───
async function handleSignalingData(data) {
    if (!peerConnection) return;

    const { sdp, candidate } = data.signal;

    try {
        if (sdp) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

            // Only callee creates an answer (when it receives an offer)
            if (sdp.type === 'offer') {
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                socketInstance.emit('signaling_signal', {
                    target_id: targetCallerId,
                    signal: { sdp: peerConnection.localDescription }
                });
            }
        } else if (candidate) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    } catch (err) {
        console.error('Signaling error:', err);
    }
}

// ─── End call ───
export function endCall() {
    if (socketInstance && targetCallerId) {
        socketInstance.emit('call_ended', { target_id: targetCallerId });
    }
    cleanupCall();
}

function handleRemoteHangup() {
    cleanupCall();
}

function cleanupCall() {
    document.getElementById('call-overlay').style.display = 'none';
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    if (localVideo) localVideo.srcObject = null;
    if (remoteVideo) remoteVideo.srcObject = null;
    targetCallerId = null;
}

function showCallUI(statusText) {
    document.getElementById('call-status-title').innerText = statusText;
    document.getElementById('call-overlay').style.display = 'flex';
}