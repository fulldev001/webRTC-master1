/* eslint-disable no-unused-expressions */
import React, { useRef, useEffect } from "react";
import io from "socket.io-client";

export const VIDEO_CHAT_SOCKET = process.env.REACT_APP_ENVIRONMENT === 'production' ?
'https://proj22-backend.herokuapp.com/' :
'http://localhost:8000/'

const Room = (props) => {
    const userVideo = useRef();
    const partnerVideo = useRef();
    const peerRef = useRef();
    const socketRef = useRef();
    const otherUser = useRef();
    const userStream = useRef();
    const senders = useRef([]);

    useEffect(() => {
            navigator?.mediaDevices?.getUserMedia({ audio: true, video: true }).then(stream => {
                userVideo.current.srcObject = stream;
                userStream.current = stream;

                socketRef.current = io.connect(VIDEO_CHAT_SOCKET, { 
                    port: null
                });

                socketRef.current.emit("join room", props.match.params.roomID);

               
                socketRef.current.on('other user', userID => {
                    callUser(userID);
                    otherUser.current = userID;
                });

                socketRef.current.on("user joined", userID => {
                    otherUser.current = userID;
                });

                socketRef.current.on("offer", handleRecieveCall);

                socketRef.current.on("answer", handleAnswer);

                socketRef.current.on("ice-candidate", handleNewICECandidateMsg);
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function callUser(userID) {
        peerRef.current = createPeer(userID);
        userStream.current.getTracks().forEach(track => senders.current.push(peerRef.current.addTrack(track, userStream.current)));
    }

    function createPeer(userID) {
        const peer = new RTCPeerConnection({
            iceServers: [
                {
                    urls: "stun:stun.stunprotocol.org"
                },
                {
                    urls: 'turn:numb.viagenie.ca',
                    credential: 'muazkh',
                    username: 'webrtc@live.com'
                },
            ]
        });

        peer.onicecandidate = handleICECandidateEvent;
        peer.ontrack = handleTrackEvent;
        peer.onnegotiationneeded = () => handleNegotiationNeededEvent(userID);

        return peer;
    }

    function handleNegotiationNeededEvent(userID) {
        peerRef.current.createOffer().then(offer => {
            return peerRef.current.setLocalDescription(offer);
        }).then(() => {
            const payload = {
                target: userID,
                caller: socketRef.current.id,
                sdp: peerRef.current.localDescription
            };
            socketRef.current.emit("offer", payload);
        }).catch(e => console.log(e));
    }

    function handleRecieveCall(incoming) {
        peerRef.current = createPeer();
        const desc = new RTCSessionDescription(incoming.sdp);
        peerRef.current.setRemoteDescription(desc).then(() => {
            userStream.current.getTracks().forEach(track => senders.current.push(peerRef.current.addTrack(track, userStream.current)));
        }).then(() => {
            return peerRef.current.createAnswer();
        }).then(answer => {
            return peerRef.current.setLocalDescription(answer);
        }).then(() => {
            const payload = {
                target: incoming.caller,
                caller: socketRef.current.id,
                sdp: peerRef.current.localDescription
            }
            socketRef.current.emit("answer", payload);
        })
    }

    function handleAnswer(message) {
        const desc = new RTCSessionDescription(message.sdp);
        peerRef.current.setRemoteDescription(desc).catch(e => console.log("e", e));

        try{
            userStream.current.getTracks().forEach(track => senders.current.push(peerRef.current.addTrack(track, userStream.current)));

        }catch(e){
            console.log("e", e)
        }
    }

    function handleICECandidateEvent(e) {
        if (e.candidate) {
            const payload = {
                target: otherUser.current,
                candidate: e.candidate,
            }
            socketRef.current.emit("ice-candidate", payload);
        }
    }

    function handleNewICECandidateMsg(incoming) {
        const candidate = new RTCIceCandidate(incoming);

        peerRef.current.addIceCandidate(candidate)
            .catch(e => console.log(e));
    }

    function handleTrackEvent(e) {
        partnerVideo.current.srcObject = e.streams[0];
    };

    function shareScreen() {
        navigator.mediaDevices.getDisplayMedia({ cursor: true }).then(stream => {
            const screenTrack = stream.getTracks()[0];
            const s1 = senders.current.filter(sender => {
                return sender.track.kind === 'video'
            })

            s1?.map((x) => x.replaceTrack(screenTrack))
        
            
            screenTrack.onended = function() {
                const s2 = senders.current.filter(sender => sender.track.kind === "video")
                s2?.map((x) => x.replaceTrack(userStream.current.getTracks()[1]));
            }
        })
    }

    return (
        <div style={{ position: "absolute", zIndex: 9999}}>
            <video controls style={{height: 500, width: 500}} autoPlay ref={userVideo} />
            <video controls style={{height: 500, width: 500}} autoPlay ref={partnerVideo} />
            <button onClick={shareScreen}>Share screen</button>
        </div>
    );
};

export default Room;