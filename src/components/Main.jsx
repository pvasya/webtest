import { useState, useRef, useEffect } from 'react';
import Webcam from 'react-webcam';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { 
    drawHandLandmarks, 
    isHandOpen, 
    calculateDistance, 
    drawMenu, 
    checkMenuHover, 
    createMenuItems 
} from '../utils/handpose';
import { RawImage } from '@huggingface/transformers';
import { generateAnswer} from '../utils/moondream2';

export const Main = ({selectedMode ,hand, camera, exportImg, setExportImg, canvasPaintRef, model, tokenizer, processor}) => {
    const webcamRef = useRef(null);
    const canvasHandsRef = useRef(null);
    const canvasMenuRef = useRef(null);
    const handLandmarkerRef = useRef(null);
    const requestRef = useRef(null);
    const textRef = useRef(null);
    const answerRef = useRef(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [color, setColor] = useState('#FF0000');
    const [lineWidth, setLineWidth] = useState(12);
    const [rightHandLandmarks, setRightHandLandmarks] = useState(null);
    const [leftHandLandmarks, setLeftHandLandmarks] = useState(null);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [menuHoverItem, setMenuHoverItem] = useState(null);
    const [menuItems, setMenuItems] = useState([]);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    const clearCanvas = () => {
        if (canvasPaintRef.current) {
            const ctx = canvasPaintRef.current.getContext('2d');
            ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
        }
    };

    useEffect(() => {
        const setupHandLandmarker = async () => {
            const vision = await FilesetResolver.forVisionTasks(
                "../../node_modules/@mediapipe/tasks-vision/wasm"
            );
            
            handLandmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "hand_landmarker.task",
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 2
            });

            setModelLoaded(true);
        };

        setupHandLandmarker();
    }, []);

    useEffect(() => {
        const updateCanvasSize = () => {
            if (webcamRef.current && webcamRef.current.video) {
                const video = webcamRef.current.video;
                const container = video.parentElement;
                const containerWidth = container.clientWidth;
                const containerHeight = container.clientHeight;
                
                if (canvasHandsRef.current && canvasMenuRef.current && canvasPaintRef.current) {
                    canvasHandsRef.current.width = containerWidth;
                    canvasHandsRef.current.height = containerHeight;
                    canvasMenuRef.current.width = containerWidth;
                    canvasMenuRef.current.height = containerHeight;
                    canvasPaintRef.current.width = containerWidth;
                    canvasPaintRef.current.height = containerHeight;
                    
                    setCanvasSize({ width: containerWidth, height: containerHeight });
                }
            }
        };

        updateCanvasSize();
        window.addEventListener('resize', updateCanvasSize);
        return () => window.removeEventListener('resize', updateCanvasSize);
    }, [modelLoaded]);

    const normalizeCoordinates = (landmarks) => {
        if (!landmarks) return null;
        return landmarks.map(point => ({
            x: (1 - point.x) * canvasSize.width,
            y: point.y * canvasSize.height
        }));
    };

    useEffect(() => {
        const detectHands = async () => {
            if (
                handLandmarkerRef.current &&
                webcamRef.current &&
                webcamRef.current.video.readyState === 4
            ) {
                const video = webcamRef.current.video;
                const results = await handLandmarkerRef.current.detectForVideo(video, performance.now());

                let rightHand = null;
                let leftHand = null;

                if (results.landmarks.length > 0) {
                    for (let i = 0; i < results.landmarks.length; i++) {
                        const handedness = results.handednesses[i][0].categoryName;
                        if (handedness === 'Right') {
                            rightHand = results.landmarks[i];
                        } else if (handedness === 'Left') {
                            leftHand = results.landmarks[i];
                        }
                    }
                }

                if (hand === 'Hand L') {
                    [rightHand, leftHand] = [leftHand, rightHand];
                }

                const normalizedRightHand = normalizeCoordinates(rightHand);
                const normalizedLeftHand = normalizeCoordinates(leftHand);

                setRightHandLandmarks(normalizedRightHand);
                setLeftHandLandmarks(normalizedLeftHand);

                
                const handsCtx = canvasHandsRef.current.getContext('2d');
                const menuCtx = canvasMenuRef.current.getContext('2d');
                handsCtx.clearRect(0, 0, canvasSize.width, canvasSize.height);
                menuCtx.clearRect(0, 0, canvasSize.width, canvasSize.height);

                if (normalizedRightHand) {
                    drawHandLandmarks(handsCtx, normalizedRightHand, 'right');
                    
                    const thumb = normalizedRightHand[4];
                    const index = normalizedRightHand[8];
                    
                    if (thumb && index) {
                        const distance = calculateDistance(thumb, index);
                        const midpoint = {
                            x: (thumb.x + index.x) / 2,
                            y: (thumb.y + index.y) / 2
                        };

                        handsCtx.beginPath();
                        handsCtx.arc(midpoint.x, midpoint.y, 8, 0, 2 * Math.PI);
                        handsCtx.fillStyle = 'yellow';
                        handsCtx.fill();

                        if (showMenu) {
                            const hoverItem = checkMenuHover(midpoint.x, midpoint.y, menuItems);
                            setMenuHoverItem(hoverItem);
                            
                            if (hoverItem && distance < 40) {
                                if (hoverItem.type === 'color') {
                                    hoverItem.action(setColor);
                                } else if (hoverItem.type === 'size') {
                                    hoverItem.action(setLineWidth);
                                } else if (hoverItem.type === 'action') {
                                    hoverItem.action(clearCanvas);
                                }
                                setShowMenu(false);
                            }
                        } else if (distance < 40) {
                            const paintCtx = canvasPaintRef.current.getContext('2d');
                            paintCtx.lineJoin = 'round';
                            paintCtx.lineCap = 'round';
                            paintCtx.strokeStyle = color;
                            paintCtx.lineWidth = lineWidth;

                            if (!isDrawing) {
                                setIsDrawing(true);
                                paintCtx.beginPath();
                                paintCtx.moveTo(midpoint.x, midpoint.y);
                            } else {
                                paintCtx.lineTo(midpoint.x, midpoint.y);
                                paintCtx.stroke();
                            }
                        } else {
                            if (isDrawing) {
                                const paintCtx = canvasPaintRef.current.getContext('2d');
                                paintCtx.stroke();
                                setIsDrawing(false);
                            }
                        }
                    }
                }

                if (normalizedLeftHand) {
                    drawHandLandmarks(handsCtx, normalizedLeftHand, 'left');
                    
                    // Check if left hand is open for menu
                    const isOpen = isHandOpen(normalizedLeftHand);
                    if (isOpen) {
                        setShowMenu(true);
                        const menuItems = createMenuItems(
                            canvasSize.width,
                            canvasSize.height,
                            hand === 'Hand R'
                        );
                        setMenuItems(menuItems);
                        drawMenu(
                            menuCtx,
                            menuItems,
                            menuHoverItem,
                            color,
                            lineWidth,
                            canvasSize.width,
                            canvasSize.height
                        );
                    } else {
                        setShowMenu(false);
                    }
                } else {
                    setShowMenu(false);
                }
            }
            requestRef.current = requestAnimationFrame(detectHands);
        };

        if (modelLoaded) {
            requestRef.current = requestAnimationFrame(detectHands);
        }

        return () => cancelAnimationFrame(requestRef.current);
    }, [modelLoaded, camera, hand, color, lineWidth, menuHoverItem, canvasSize, showMenu, menuItems]);

    return (
        <div className="flex-grow w-full bg-gray-800 p-2 pt-20 md:pt-8 pb-16 text-white flex flex-col md:flex-row justify-center items-center">
            <div className="flex justify-center items-center w-full md:w-auto">
                <div className="flex items-center justify-center w-[min(100vw-1rem,calc(100vh-14rem)+20px)] aspect-square bg-black rounded-lg overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-full bg-white"></div>
                    <Webcam
                        ref={webcamRef}
                        audio={false}
                        mirrored={true}
                        className={`w-full h-full object-cover ${camera === 'Camera On' ? 'invisible' : ''}`}
                        style={{ maxHeight: '100%', maxWidth: '100%' }}
                        videoConstraints={{
                            facingMode: 'user',
                            aspectRatio: 1.0,
                        }}
                    />
                    <canvas
                        ref={canvasPaintRef}
                        className="absolute top-0 left-0 w-full h-full"
                        style={{ maxHeight: '100%', maxWidth: '100%' }}
                    ></canvas>
                    <canvas
                        ref={canvasHandsRef}
                        className="absolute top-0 left-0 w-full h-full"
                        style={{ maxHeight: '100%', maxWidth: '100%' }}
                    ></canvas>
                    <canvas
                        ref={canvasMenuRef}
                        className="absolute top-0 left-0 w-full h-full"
                        style={{ maxHeight: '100%', maxWidth: '100%' }}
                    ></canvas>
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 p-1 rounded text-xs">
                        {modelLoaded ? "Model loaded" : "Loading model..."}
                    </div>
                </div>
            </div>
            <div className="flex flex-col bg-gray-900 rounded-lg p-2 w-full md:w-80 h-[calc(100vh-14rem)]">
                <div className="flex flex-col mb-2 relative">
                    <div className="flex relative">
                        <input
                            ref={textRef}
                            type="text"
                            className="rounded p-2 h-12 bg-gray-800 text-white placeholder-white-500 outline-none flex-1 mr-2"
                            placeholder="Ask Moondream2..."
                            maxLength={100}
                        />
                        <button
                            type="button"
                            onClick={async() => {
                                if (selectedMode === 'Client' &&( !model || !tokenizer || !processor)) {
                                    alert('Model, tokenizer, or processor not loaded');
                                    return;
                                }
                                let req = textRef.current.value;
                                if (req.length === 0) {
                                    req = "Describe the image";
                                }
                                let res = "";
                                req = 'dsd';
                                try {
                                   // res = await generateAnswer(
                                     //   model,
                                     //   tokenizer,
                                     //   processor,
                                     //   req,
                                     //   canvasPaintRef.current,
                                     //   selectedMode
                                     // );
                                    console.log(res);
                                } catch (error) {
                                    console.error('Error generating answer:', error);
                                }
                            }}
                            className="bg-blue-500 px-4 py-2 rounded transition-transform transform hover:scale-105 hover:cursor-pointer active:brightness-125 h-12">
                            send
                        </button>
                    </div>
                </div>
                <div ref={answerRef} className="flex-1 bg-gray-800 rounded p-2">
                </div>
            </div>
        </div>
    );
};
