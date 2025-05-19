import { useState, useRef } from 'react'
import './App.css'
import { Header } from './components/Header.jsx'
import { Main } from './components/Main.jsx'
import { Footer } from './components/Footer.jsx'


export function App() {
  const [selectedMode, setSelectedMode] = useState('Hybrid');
  const [isModelDownloaded, setisModelDownloaded] = useState(false);

  const [hand, setHand] = useState('Hand R');
  const [camera, setCamera] = useState('Camera On');
  const canvasPaintRef = useRef(null);

  const [model, setModel] = useState(null);
  const [processor, setProcessor] = useState(null);
  const [tokenizer, setTokenizer] = useState(null);

  return (
    <div className="flex flex-col h-screen">
      <Header model={model} setModel={setModel} processor={processor} setProcessor={setProcessor} tokenizer={tokenizer} setTokenizer={setTokenizer} selectedMode={selectedMode} setSelectedMode={setSelectedMode} isModelDownloaded={isModelDownloaded} setisModelDownloaded={setisModelDownloaded} />
      <Main model={model} setModel={setModel} processor={processor} setProcessor={setProcessor} tokenizer={tokenizer} setTokenizer={setTokenizer} selectedMode={selectedMode} hand={hand} setHand={setHand} camera={camera} setCamera={setCamera} canvasPaintRef={canvasPaintRef} />
      <Footer hand={hand} setHand={setHand} camera={camera} setCamera={setCamera} canvasPaintRef={canvasPaintRef} />
    </div>
  )
}