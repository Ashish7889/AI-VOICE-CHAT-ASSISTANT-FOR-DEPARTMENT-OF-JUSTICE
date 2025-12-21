/* global React, ReactDOM */
const { useState, useEffect, useRef, useCallback } = React;

function ChatUI() {
  const [messages, setMessages] = useState([
    { who: 'JARVIS', text: 'Good day, sir. I am JARVIS - your Department of Justice Virtual Assistant. How may I assist you today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lang, setLang] = useState('en-IN');
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));
  const [isListening, setIsListening] = useState(false);
  const [isAwake, setIsAwake] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const recognitionRef = useRef(null);
  const continuousRecognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const fileInputRef = useRef(null);

  // Wake words for activation
  const wakeWords = ['jarvis', 'hey jarvis', 'ok jarvis', 'computer', 'assistant'];
  
  const checkForWakeWord = useCallback((transcript) => {
    const lowerTranscript = transcript.toLowerCase();
    return wakeWords.some(word => lowerTranscript.includes(word));
  }, []);

  const initializeVoiceRecognition = useCallback(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      // Regular recognition for manual input
      const rec = new SR();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = false;
      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;

      // Continuous recognition for wake word detection
      if (voiceMode) {
        const continuousRec = new SR();
        continuousRec.lang = lang;
        continuousRec.continuous = true;
        continuousRec.interimResults = true;
        
        continuousRec.onresult = (e) => {
          const transcript = e.results[e.results.length - 1][0].transcript;
          
          if (checkForWakeWord(transcript)) {
            setIsAwake(true);
            setMessages(m => [...m, { who: 'System', text: '🔵 JARVIS Activated - Listening...' }]);
            speak('Yes, how can I help you?');
            
            // Stop continuous listening and start command listening
            continuousRec.stop();
            setTimeout(() => {
              startCommandListening();
            }, 1000);
          }
        };
        
        continuousRec.onerror = (e) => {
          console.log('Continuous recognition error:', e.error);
          if (voiceMode) {
            setTimeout(() => continuousRec.start(), 1000);
          }
        };
        
        continuousRec.onend = () => {
          if (voiceMode && !isAwake) {
            setTimeout(() => continuousRec.start(), 100);
          }
        };
        
        continuousRecognitionRef.current = continuousRec;
      }
    }
  }, [lang, voiceMode, checkForWakeWord, isAwake]);

  useEffect(() => {
    initializeVoiceRecognition();
    
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (continuousRecognitionRef.current) continuousRecognitionRef.current.stop();
    };
  }, [initializeVoiceRecognition]);

  const speak = (text, interrupt = true) => {
    if (interrupt) {
      window.speechSynthesis.cancel();
    }
    
    if ('speechSynthesis' in window) {
      const uttr = new SpeechSynthesisUtterance(text);
      uttr.lang = lang;
      uttr.rate = 1.1; // Slightly faster for JARVIS feel
      uttr.pitch = 0.9; // Slightly lower pitch
      
      // Try to get a more suitable voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(voice => 
        voice.lang.startsWith(lang.split('-')[0]) && 
        (voice.name.includes('Male') || voice.name.includes('David') || voice.name.includes('Alex'))
      ) || voices.find(voice => voice.lang.startsWith(lang.split('-')[0]));
      
      if (preferredVoice) {
        uttr.voice = preferredVoice;
      }
      
      window.speechSynthesis.speak(uttr);
    }
  };
  
  const startCommandListening = useCallback(() => {
    if (recognitionRef.current) {
      setIsListening(true);
      setIsProcessing(false);
      
      const commandRec = recognitionRef.current;
      commandRec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
        setIsProcessing(true);
        
        // Automatically send the command
        setTimeout(() => {
          processVoiceCommand(transcript);
        }, 500);
      };
      
      commandRec.start();
      
      // Auto-timeout after 10 seconds
      setTimeout(() => {
        if (isListening) {
          commandRec.stop();
          setIsListening(false);
          setIsAwake(false);
          speak('Command timeout. I\'m going back to standby mode.');
          if (voiceMode) {
            startContinuousListening();
          }
        }
      }, 10000);
    }
  }, [isListening, voiceMode]);
  
  const startContinuousListening = useCallback(() => {
    if (continuousRecognitionRef.current && voiceMode) {
      try {
        continuousRecognitionRef.current.start();
        setMessages(m => [...m, { who: 'System', text: '🔴 JARVIS Standby Mode - Say "Hey JARVIS" to activate' }]);
      } catch (e) {
        console.log('Could not start continuous listening:', e);
      }
    }
  }, [voiceMode]);
  
  const processVoiceCommand = async (command) => {
    setMessages(m => [...m, { who: 'You', text: command }]);
    setInput('');
    setIsProcessing(true);
    
    try {
      const res = await fetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: command, session_id: sessionId, language: lang }),
      });
      const data = await res.json();
      const answer = data.answer || 'I apologize, but I could not process that request.';
      
      setMessages(m => [...m, { who: 'JARVIS', text: answer }]);
      
      // Speak the response
      speak(answer);
      
      // Return to listening mode after response
      setTimeout(() => {
        setIsAwake(false);
        setIsProcessing(false);
        if (voiceMode) {
          startContinuousListening();
        }
      }, 2000);
      
    } catch (e) {
      const errorMsg = 'I\'m sorry, I encountered an error processing your request.';
      setMessages(m => [...m, { who: 'JARVIS', text: errorMsg }]);
      speak(errorMsg);
      setIsAwake(false);
      setIsProcessing(false);
      if (voiceMode) {
        startContinuousListening();
      }
    }
  };

  const send = async () => {
    const q = input.trim();
    if (!q) return;
    setMessages(m => [...m, { who: 'You', text: q }]);
    setInput('');
    setLoading(true);
    
    try {
      const res = await fetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, session_id: sessionId, language: lang }),
      });
      const data = await res.json();
      const answer = data.answer || 'No answer available.';
      const sources = (data.sources || []).map(s => s.title).filter(Boolean).join(', ');
      const full = sources ? `${answer}\n\nSources: ${sources}` : answer;
      
      setMessages(m => [...m, { who: 'JARVIS', text: full }]);
      
      // Always speak if voice mode is on
      if (voiceMode) {
        speak(answer);
      } else {
        // Try server-side TTS first, else fallback to browser speechSynthesis
        try {
          const ttsRes = await fetch(`/tts?text=${encodeURIComponent(answer)}`, { method: 'POST' });
          if (ttsRes.ok) {
            const blob = await ttsRes.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.play();
          } else {
            speak(answer);
          }
        } catch (_) {
          speak(answer);
        }
      }
    } catch (e) {
      setMessages(m => [...m, { who: 'JARVIS', text: 'Error contacting server.' }]);
      speak('I apologize, but I encountered an error.');
    } finally {
      setLoading(false);
    }
  };
  
  const toggleVoiceMode = () => {
    const newVoiceMode = !voiceMode;
    setVoiceMode(newVoiceMode);
    
    if (newVoiceMode) {
      speak('Voice mode activated. I am now listening for wake words. Say "Hey JARVIS" to get my attention.');
      setMessages(m => [...m, { who: 'System', text: '🔴 Voice Mode ON - JARVIS is listening for "Hey JARVIS"' }]);
      setTimeout(() => {
        startContinuousListening();
      }, 3000);
    } else {
      speak('Voice mode deactivated. Goodbye.');
      setMessages(m => [...m, { who: 'System', text: '⚫ Voice Mode OFF' }]);
      setIsAwake(false);
      setIsListening(false);
      if (continuousRecognitionRef.current) {
        continuousRecognitionRef.current.stop();
      }
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      send();
    }
    // Quick voice activation with spacebar
    if (e.key === ' ' && e.ctrlKey) {
      e.preventDefault();
      startVoice();
    }
  };

  const startVoice = () => {
    if (recognitionRef.current && !voiceMode) {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };
  
  const getStatusIndicator = () => {
    if (voiceMode) {
      if (isProcessing) return '🟡 Processing...';
      if (isAwake && isListening) return '🟢 Listening for command...';
      if (isAwake) return '🔵 JARVIS Active';
      return '🔴 JARVIS Standby';
    }
    if (isListening) return '🎤 Listening...';
    if (loading) return '⏳ Processing...';
    return '⚫ Ready';
  };

  return (
    <div className={`card ${voiceMode ? 'voice-mode' : ''}`} role="main" aria-label="JARVIS - DoJ Virtual Assistant">
      <div className="header">
        <div className="title-section">
          <h2 style={{margin:0, color: voiceMode ? '#00d4ff' : '#333'}}>
            🤖 JARVIS - DoJ Virtual Assistant
          </h2>
          <div className="status-indicator" style={{fontSize: '0.9em', marginTop: '4px'}}>
            {getStatusIndicator()}
          </div>
        </div>
        
        <div className="controls">
          <button 
            onClick={toggleVoiceMode} 
            className={`voice-toggle ${voiceMode ? 'active' : ''}`}
            aria-label="Toggle Iron Man Voice Mode"
            style={{
              background: voiceMode ? '#ff4444' : '#00d4ff',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '50px',
              height: '50px',
              fontSize: '1.5em',
              cursor: 'pointer',
              margin: '0 10px',
              boxShadow: voiceMode ? '0 0 20px #ff4444' : '0 0 15px #00d4ff',
              transition: 'all 0.3s ease'
            }}
          >
            {voiceMode ? '🔴' : '🔵'}
          </button>
          
          <div>
            <label htmlFor="lang">Language: </label>
            <select id="lang" value={lang} onChange={e => setLang(e.target.value)}>
              <option value="en-IN">English (India)</option>
              <option value="hi-IN">Hindi</option>
              <option value="bn-IN">Bengali</option>
              <option value="ta-IN">Tamil</option>
              <option value="te-IN">Telugu</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="messages" aria-live="polite" style={{
        background: voiceMode ? 'linear-gradient(135deg, #001122 0%, #003366 100%)' : '#fafafa',
        border: voiceMode ? '1px solid #00d4ff' : '1px solid #eee',
        boxShadow: voiceMode ? 'inset 0 0 20px rgba(0,212,255,0.3)' : 'none'
      }}>
        {messages.map((m, i) => (
          <div key={i} className="msg" style={{
            color: voiceMode ? (m.who === 'JARVIS' ? '#00d4ff' : m.who === 'System' ? '#ffaa00' : '#ffffff') : 'inherit'
          }}>
            <span className="who" style={{
              color: voiceMode ? 
                (m.who === 'JARVIS' ? '#00d4ff' : 
                 m.who === 'System' ? '#ffaa00' : 
                 m.who === 'You' ? '#00ff88' : '#ffffff') : 'inherit',
              fontWeight: '600'
            }}>
              {m.who === 'JARVIS' ? '🤖 JARVIS' : m.who === 'System' ? '⚙️ System' : m.who}:
            </span>
            <span style={{marginLeft: '8px'}}>{m.text}</span>
          </div>
        ))}
        
        {voiceMode && (isListening || isProcessing) && (
          <div className="voice-indicator" style={{
            textAlign: 'center',
            padding: '20px',
            animation: 'pulse 2s infinite'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: isProcessing ? 
                'radial-gradient(circle, #ffaa00 0%, #ff6600 100%)' :
                'radial-gradient(circle, #00d4ff 0%, #0088cc 100%)',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5em',
              boxShadow: `0 0 30px ${isProcessing ? '#ffaa00' : '#00d4ff'}`
            }}>
              {isProcessing ? '⚙️' : '🎤'}
            </div>
          </div>
        )}
      </div>
      
      <div className="input" style={{
        background: voiceMode ? 'rgba(0,212,255,0.1)' : 'transparent',
        border: voiceMode ? '1px solid #00d4ff' : 'none',
        borderRadius: '8px',
        padding: voiceMode ? '8px' : '0'
      }}>
        <textarea 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          onKeyDown={onKeyDown} 
          aria-label="Your message" 
          placeholder={voiceMode ? 
            "Voice Mode Active - Say 'Hey JARVIS' or type here... (Ctrl+Space for voice, Ctrl+Enter to send)" :
            "Type your question... (Ctrl+Enter to send, Ctrl+Space for voice)"
          }
          disabled={voiceMode && (isListening || isProcessing)}
          style={{
            background: voiceMode ? 'rgba(0,50,100,0.8)' : 'white',
            color: voiceMode ? '#ffffff' : 'black',
            border: voiceMode ? '1px solid #00d4ff' : '1px solid #ddd'
          }}
        />
        
        <button 
          onClick={send} 
          disabled={loading || (voiceMode && (isListening || isProcessing))} 
          aria-label="Send message"
          style={{
            background: voiceMode ? '#00d4ff' : '#00428e',
            opacity: (loading || (voiceMode && (isListening || isProcessing))) ? 0.5 : 1
          }}
        >
          {loading ? '⏳' : 'Send'}
        </button>
        
        {!voiceMode && (
          <button 
            onClick={startVoice} 
            disabled={isListening}
            aria-label="Start voice input"
            style={{
              background: isListening ? '#ff4444' : '#00d4ff',
              opacity: isListening ? 0.7 : 1
            }}
          >
            {isListening ? '🔴' : '🎤'}
          </button>
        )}
      </div>
      
      {voiceMode && (
        <div className="voice-commands" style={{
          fontSize: '0.8em',
          color: '#888',
          textAlign: 'center',
          marginTop: '10px',
          padding: '10px',
          background: 'rgba(0,212,255,0.1)',
          borderRadius: '5px'
        }}>
          💬 Voice Commands: "Hey JARVIS", "OK JARVIS", "Computer", "Assistant" |
          🎯 Try: "What are my rights?", "How to file a complaint?", "Tell me about the constitution"
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<ChatUI />);
