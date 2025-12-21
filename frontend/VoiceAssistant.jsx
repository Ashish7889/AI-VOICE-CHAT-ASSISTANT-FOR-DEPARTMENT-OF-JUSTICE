/* global React, ReactDOM, MediaRecorder */
const { useState, useEffect, useRef, useCallback } = React;

// Advanced Voice Assistant Component
function VoiceAssistant() {
  // State Management
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      who: 'JARVIS', 
      text: 'नमस्कार! मैं JARVIS हूँ - आपका न्याय विभाग सहायक। आज मैं आपकी कैसे सहायता कर सकता हूँ?', 
      timestamp: new Date(),
      language: 'hi'
    }
  ]);
  
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('hi-IN');
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAwake, setIsAwake] = useState(false);
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));
  const [audioLevel, setAudioLevel] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [voiceSettings, setVoiceSettings] = useState({
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0
  });

  // Refs
  const recognitionRef = useRef(null);
  const continuousRecognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const messagesEndRef = useRef(null);
  const timeoutRef = useRef(null);

  // Indian Languages Configuration
  const indianLanguages = {
    'hi-IN': { 
      name: 'Hindi', 
      nativeName: 'हिन्दी',
      code: 'hi',
      wakeWords: ['जार्विस', 'हे जार्विस', 'कंप्यूटर', 'सहायक'],
      greeting: 'नमस्कार! मैं आपकी कैसे सहायता कर सकता हूँ?'
    },
    'en-IN': { 
      name: 'English (India)', 
      nativeName: 'English',
      code: 'en',
      wakeWords: ['jarvis', 'hey jarvis', 'computer', 'assistant'],
      greeting: 'Hello! How can I assist you today?'
    },
    'bn-IN': { 
      name: 'Bengali', 
      nativeName: 'বাংলা',
      code: 'bn',
      wakeWords: ['জার্ভিস', 'হে জার্ভিস', 'কম্পিউটার', 'সহায়ক'],
      greeting: 'নমস্কার! আমি আপনাকে কীভাবে সাহায্য করতে পারি?'
    },
    'ta-IN': { 
      name: 'Tamil', 
      nativeName: 'தமிழ்',
      code: 'ta',
      wakeWords: ['ஜார்விஸ்', 'ஹே ஜார்விஸ்', 'கணினி', 'உதவியாளர்'],
      greeting: 'வணக்கம்! நான் உங்களுக்கு எப்படி உதவ முடியும்?'
    },
    'te-IN': { 
      name: 'Telugu', 
      nativeName: 'తెలుగు',
      code: 'te',
      wakeWords: ['జార్విస్', 'హే జార్విస్', 'కంప్యూటర్', 'సహాయకుడు'],
      greeting: 'నమస్కారం! నేను మీకు ఎలా సహాయం చేయగలను?'
    },
    'ml-IN': { 
      name: 'Malayalam', 
      nativeName: 'മലയാളം',
      code: 'ml',
      wakeWords: ['ജാർവിസ്', 'ഹേ ജാർവിസ്', 'കമ്പ്യൂട്ടർ', 'സഹായി'],
      greeting: 'നമസ്കാരം! എനിക്ക് നിങ്ങളെ എങ്ങനെ സഹായിക്കാം?'
    },
    'kn-IN': { 
      name: 'Kannada', 
      nativeName: 'ಕನ್ನಡ',
      code: 'kn',
      wakeWords: ['ಜಾರ್ವಿಸ್', 'ಹೇ ಜಾರ್ವಿಸ್', 'ಕಂಪ್ಯೂಟರ್', 'ಸಹಾಯಕ'],
      greeting: 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?'
    },
    'gu-IN': { 
      name: 'Gujarati', 
      nativeName: 'ગુજરાતી',
      code: 'gu',
      wakeWords: ['જાર્વિસ', 'હે જાર્વિસ', 'કમ્પ્યુટર', 'સહાયક'],
      greeting: 'નમસ્કાર! હું તમારી કેવી રીતે મદદ કરી શકું?'
    },
    'mr-IN': { 
      name: 'Marathi', 
      nativeName: 'मराठी',
      code: 'mr',
      wakeWords: ['जार्विस', 'हे जार्विस', 'संगणक', 'सहाय्यक'],
      greeting: 'नमस्कार! मी तुमची कशी मदत करू शकतो?'
    },
    'pa-IN': { 
      name: 'Punjabi', 
      nativeName: 'ਪੰਜਾਬੀ',
      code: 'pa',
      wakeWords: ['ਜਾਰਵਿਸ', 'ਹੇ ਜਾਰਵਿਸ', 'ਕੰਪਿਊਟਰ', 'ਸਹਾਇਕ'],
      greeting: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ਤੁਹਾਡੀ ਕਿਵੇਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?'
    },
    'ur-IN': { 
      name: 'Urdu', 
      nativeName: 'اردو',
      code: 'ur',
      wakeWords: ['جارویس', 'ارے جارویس', 'کمپیوٹر', 'معاون'],
      greeting: 'السلام علیکم! میں آپ کی کیسے مدد کر سکتا ہوں؟'
    }
  };

  // Advanced Wake Word Detection
  const checkForWakeWord = useCallback((transcript) => {
    const currentLang = indianLanguages[currentLanguage];
    if (!currentLang) return false;
    
    const lowerTranscript = transcript.toLowerCase();
    return currentLang.wakeWords.some(word => 
      lowerTranscript.includes(word.toLowerCase())
    );
  }, [currentLanguage]);

  // Audio Level Monitoring
  const setupAudioMonitoring = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      const microphone = audioContextRef.current.createMediaStreamSource(stream);
      microphone.connect(analyserRef.current);
      
      analyserRef.current.fftSize = 256;
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateAudioLevel = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, value) => sum + value) / bufferLength;
          setAudioLevel(average);
          
          if (voiceMode) {
            requestAnimationFrame(updateAudioLevel);
          }
        }
      };
      
      updateAudioLevel();
    } catch (error) {
      console.error('Audio monitoring setup failed:', error);
    }
  }, [voiceMode]);

  // Enhanced Speech Recognition Setup
  const setupSpeechRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      addSystemMessage('Speech recognition not supported in this browser', 'error');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    // Command Recognition
    const commandRecognition = new SpeechRecognition();
    commandRecognition.lang = currentLanguage;
    commandRecognition.continuous = false;
    commandRecognition.interimResults = false;
    commandRecognition.maxAlternatives = 3;
    
    commandRecognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const confidence = event.results[0][0].confidence;
      
      console.log(`Recognized: "${transcript}" (confidence: ${confidence})`);
      
      if (confidence > 0.3) {
        setInput(transcript);
        setIsListening(false);
        processVoiceCommand(transcript);
      } else {
        addSystemMessage('Please speak more clearly', 'warning');
        setIsListening(false);
      }
    };

    commandRecognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      if (event.error === 'no-speech') {
        addSystemMessage('No speech detected. Try again.', 'warning');
      } else if (event.error === 'network') {
        addSystemMessage('Network error. Check your connection.', 'error');
      }
    };

    commandRecognition.onend = () => {
      setIsListening(false);
      if (voiceMode && !isAwake) {
        setTimeout(() => startContinuousListening(), 1000);
      }
    };

    recognitionRef.current = commandRecognition;

    // Continuous Wake Word Recognition
    if (voiceMode) {
      const wakeWordRecognition = new SpeechRecognition();
      wakeWordRecognition.lang = currentLanguage;
      wakeWordRecognition.continuous = true;
      wakeWordRecognition.interimResults = true;
      
      wakeWordRecognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          
          if (checkForWakeWord(transcript)) {
            wakeWordRecognition.stop();
            activateAssistant();
            break;
          }
        }
      };

      wakeWordRecognition.onerror = (event) => {
        console.error('Wake word recognition error:', event.error);
        if (voiceMode && event.error !== 'aborted') {
          setTimeout(() => {
            try {
              wakeWordRecognition.start();
            } catch (e) {
              console.error('Failed to restart wake word recognition:', e);
            }
          }, 2000);
        }
      };

      wakeWordRecognition.onend = () => {
        if (voiceMode && !isAwake) {
          setTimeout(() => {
            try {
              wakeWordRecognition.start();
            } catch (e) {
              console.error('Failed to restart wake word recognition:', e);
            }
          }, 100);
        }
      };

      continuousRecognitionRef.current = wakeWordRecognition;
    }
  }, [currentLanguage, voiceMode, checkForWakeWord, isAwake]);

  // Enhanced Text-to-Speech with Indian Language Support
  const speak = useCallback((text, options = {}) => {
    return new Promise((resolve) => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        const currentLang = indianLanguages[currentLanguage];
        
        utterance.lang = currentLanguage;
        utterance.rate = options.rate || voiceSettings.rate;
        utterance.pitch = options.pitch || voiceSettings.pitch;
        utterance.volume = options.volume || voiceSettings.volume;
        
        // Get better voice for Indian languages
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(voice => {
          const langCode = currentLang.code;
          return voice.lang.startsWith(langCode) || 
                 voice.lang.startsWith(currentLanguage) ||
                 (voice.name.toLowerCase().includes('hindi') && langCode === 'hi') ||
                 (voice.name.toLowerCase().includes('google') && voice.lang.startsWith(langCode));
        });
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
        
        utterance.onend = resolve;
        utterance.onerror = resolve;
        
        window.speechSynthesis.speak(utterance);
      } else {
        resolve();
      }
    });
  }, [currentLanguage, voiceSettings]);

  // System Message Helper
  const addSystemMessage = (message, type = 'info') => {
    const systemMessage = {
      id: Date.now(),
      who: 'System',
      text: message,
      timestamp: new Date(),
      type: type,
      language: indianLanguages[currentLanguage].code
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  // Assistant Activation
  const activateAssistant = async () => {
    setIsAwake(true);
    setIsListening(true);
    
    const currentLang = indianLanguages[currentLanguage];
    addSystemMessage(`🟢 JARVIS Activated - ${currentLang.nativeName}`, 'success');
    
    await speak(currentLang.greeting, { rate: 1.1, pitch: 0.9 });
    
    // Start command listening
    setTimeout(() => {
      if (recognitionRef.current && isAwake) {
        try {
          recognitionRef.current.start();
        } catch (error) {
          console.error('Failed to start command recognition:', error);
          setIsListening(false);
        }
      }
    }, 500);
    
    // Auto timeout after 15 seconds
    timeoutRef.current = setTimeout(() => {
      if (isAwake && !isProcessing) {
        deactivateAssistant('timeout');
      }
    }, 15000);
  };

  // Assistant Deactivation
  const deactivateAssistant = async (reason = 'manual') => {
    setIsAwake(false);
    setIsListening(false);
    setIsProcessing(false);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    const messages = {
      'timeout': 'Returning to standby mode',
      'completed': 'Task completed',
      'manual': 'Deactivated'
    };
    
    addSystemMessage(`🔴 ${messages[reason] || messages.manual}`, 'info');
    
    if (voiceMode) {
      setTimeout(() => startContinuousListening(), 2000);
    }
  };

  // Process Voice Commands
  const processVoiceCommand = async (command) => {
    setIsProcessing(true);
    clearTimeout(timeoutRef.current);
    
    const userMessage = {
      id: Date.now(),
      who: 'You',
      text: command,
      timestamp: new Date(),
      language: indianLanguages[currentLanguage].code
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    try {
      const response = await fetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: command,
          session_id: sessionId,
          language: currentLanguage,
          voice_mode: true
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const answer = data.answer || 'I apologize, but I could not process your request.';
      
      const assistantMessage = {
        id: Date.now() + 1,
        who: 'JARVIS',
        text: answer,
        timestamp: new Date(),
        language: indianLanguages[currentLanguage].code,
        sources: data.sources || []
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Speak the response
      await speak(answer);
      
      setIsProcessing(false);
      
      // Return to listening or standby
      setTimeout(() => {
        deactivateAssistant('completed');
      }, 1000);
      
    } catch (error) {
      console.error('Voice command processing error:', error);
      
      const errorMessage = 'I apologize, there was an error processing your request.';
      const assistantMessage = {
        id: Date.now() + 1,
        who: 'JARVIS',
        text: errorMessage,
        timestamp: new Date(),
        language: indianLanguages[currentLanguage].code,
        type: 'error'
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      await speak(errorMessage);
      
      setIsProcessing(false);
      deactivateAssistant('completed');
    }
  };

  // Start Continuous Listening
  const startContinuousListening = useCallback(() => {
    if (continuousRecognitionRef.current && voiceMode) {
      try {
        continuousRecognitionRef.current.start();
        const currentLang = indianLanguages[currentLanguage];
        addSystemMessage(`🔴 Listening for wake words in ${currentLang.nativeName}`, 'info');
      } catch (error) {
        console.error('Failed to start continuous listening:', error);
      }
    }
  }, [voiceMode, currentLanguage]);

  // Toggle Voice Mode
  const toggleVoiceMode = async () => {
    const newVoiceMode = !voiceMode;
    setVoiceMode(newVoiceMode);
    
    if (newVoiceMode) {
      const currentLang = indianLanguages[currentLanguage];
      await speak(`Voice mode activated in ${currentLang.name}. Say ${currentLang.wakeWords[0]} to get my attention.`);
      setupAudioMonitoring();
      setTimeout(() => startContinuousListening(), 3000);
    } else {
      await speak('Voice mode deactivated.');
      setIsAwake(false);
      setIsListening(false);
      
      if (continuousRecognitionRef.current) {
        continuousRecognitionRef.current.stop();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    }
  };

  // Manual Send Function
  const sendMessage = async () => {
    const query = input.trim();
    if (!query) return;
    
    const userMessage = {
      id: Date.now(),
      who: 'You',
      text: query,
      timestamp: new Date(),
      language: indianLanguages[currentLanguage].code
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);
    
    try {
      const response = await fetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query,
          session_id: sessionId,
          language: currentLanguage,
          voice_mode: false
        })
      });
      
      const data = await response.json();
      const answer = data.answer || 'No answer available.';
      
      const assistantMessage = {
        id: Date.now() + 1,
        who: 'JARVIS',
        text: answer,
        timestamp: new Date(),
        language: indianLanguages[currentLanguage].code,
        sources: data.sources || []
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      if (voiceMode) {
        await speak(answer);
      }
      
    } catch (error) {
      console.error('Message send error:', error);
      setConnectionStatus('error');
      
      const errorMessage = {
        id: Date.now() + 1,
        who: 'JARVIS',
        text: 'Connection error. Please check your network and try again.',
        timestamp: new Date(),
        language: indianLanguages[currentLanguage].code,
        type: 'error'
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Language Change Handler
  const handleLanguageChange = async (newLanguage) => {
    setCurrentLanguage(newLanguage);
    
    if (voiceMode) {
      // Stop current recognition
      if (continuousRecognitionRef.current) {
        continuousRecognitionRef.current.stop();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      
      // Restart with new language
      setTimeout(() => {
        setupSpeechRecognition();
        startContinuousListening();
      }, 1000);
    }
    
    const currentLang = indianLanguages[newLanguage];
    const welcomeMessage = {
      id: Date.now(),
      who: 'JARVIS',
      text: `Language changed to ${currentLang.nativeName}. ${currentLang.greeting}`,
      timestamp: new Date(),
      language: currentLang.code
    };
    
    setMessages(prev => [...prev, welcomeMessage]);
    
    if (voiceMode) {
      await speak(currentLang.greeting);
    }
  };

  // Effects
  useEffect(() => {
    setupSpeechRecognition();
    
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      if (continuousRecognitionRef.current) continuousRecognitionRef.current.stop();
      if (audioContextRef.current) audioContextRef.current.close();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [setupSpeechRecognition]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Connection Status Check
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('/healthz');
        setConnectionStatus(response.ok ? 'connected' : 'error');
      } catch {
        setConnectionStatus('error');
      }
    };
    
    checkConnection();
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Status Indicator
  const getStatusIndicator = () => {
    if (connectionStatus === 'error') return '🔴 Connection Error';
    if (voiceMode) {
      if (isProcessing) return '🟡 Processing...';
      if (isAwake && isListening) return '🟢 Listening...';
      if (isAwake) return '🔵 JARVIS Active';
      return '🟠 Standby Mode';
    }
    if (isProcessing) return '⏳ Processing...';
    return '✅ Ready';
  };

  // Audio Visualizer Component
  const AudioVisualizer = () => (
    <div className="audio-visualizer">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="audio-bar"
          style={{
            height: `${Math.max(2, (audioLevel / 255) * 50 + Math.random() * 10)}px`,
            animationDelay: `${i * 0.1}s`
          }}
        />
      ))}
    </div>
  );

  return (
    <div className={`advanced-voice-assistant ${voiceMode ? 'voice-active' : ''}`}>
      {/* Header */}
      <div className="assistant-header">
        <div className="title-section">
          <h1>🤖 JARVIS - DoJ Assistant</h1>
          <div className="status-bar">
            <span className="status">{getStatusIndicator()}</span>
            <span className="language-indicator">
              {indianLanguages[currentLanguage].nativeName}
            </span>
          </div>
        </div>
        
        <div className="controls-section">
          {/* Voice Mode Toggle */}
          <button
            className={`voice-mode-toggle ${voiceMode ? 'active' : ''}`}
            onClick={toggleVoiceMode}
            disabled={isProcessing}
          >
            {voiceMode ? '🔴' : '🔵'}
            <span>{voiceMode ? 'Voice ON' : 'Voice OFF'}</span>
          </button>
          
          {/* Language Selector */}
          <select
            value={currentLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="language-selector"
            disabled={isListening || isProcessing}
          >
            {Object.entries(indianLanguages).map(([code, lang]) => (
              <option key={code} value={code}>
                {lang.nativeName} ({lang.name})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audio Visualizer */}
      {voiceMode && (isListening || audioLevel > 10) && (
        <div className="audio-visualization">
          <AudioVisualizer />
        </div>
      )}

      {/* Messages Area */}
      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.who.toLowerCase()}`}>
            <div className="message-header">
              <span className="sender">
                {message.who === 'JARVIS' ? '🤖 JARVIS' : 
                 message.who === 'System' ? '⚙️ System' : 
                 message.who === 'You' ? '👤 You' : message.who}
              </span>
              <span className="timestamp">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <div className="message-content">
              {message.text}
              {message.sources && message.sources.length > 0 && (
                <div className="message-sources">
                  <strong>Sources:</strong> {message.sources.map(s => s.title).join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="input-section">
        <div className="input-container">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Type your message in ${indianLanguages[currentLanguage].nativeName}...`}
            disabled={isProcessing || (voiceMode && (isListening || isAwake))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                sendMessage();
              }
            }}
            className="message-input"
          />
          
          <div className="input-controls">
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isProcessing}
              className="send-button"
            >
              {isProcessing ? '⏳' : '📤'}
            </button>
            
            {!voiceMode && (
              <button
                onClick={() => {
                  if (recognitionRef.current && !isListening) {
                    setIsListening(true);
                    recognitionRef.current.start();
                  }
                }}
                disabled={isListening || isProcessing}
                className="voice-input-button"
              >
                {isListening ? '🔴' : '🎤'}
              </button>
            )}
          </div>
        </div>
        
        {voiceMode && (
          <div className="voice-commands-help">
            <p><strong>Wake Words ({indianLanguages[currentLanguage].nativeName}):</strong></p>
            <div className="wake-words">
              {indianLanguages[currentLanguage].wakeWords.map((word, i) => (
                <span key={i} className="wake-word">"{word}"</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Voice Settings Panel */}
      {voiceMode && (
        <div className="voice-settings">
          <details>
            <summary>Voice Settings</summary>
            <div className="settings-grid">
              <label>
                Speed: {voiceSettings.rate.toFixed(1)}
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={voiceSettings.rate}
                  onChange={(e) => setVoiceSettings(prev => ({
                    ...prev,
                    rate: parseFloat(e.target.value)
                  }))}
                />
              </label>
              
              <label>
                Pitch: {voiceSettings.pitch.toFixed(1)}
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={voiceSettings.pitch}
                  onChange={(e) => setVoiceSettings(prev => ({
                    ...prev,
                    pitch: parseFloat(e.target.value)
                  }))}
                />
              </label>
              
              <label>
                Volume: {voiceSettings.volume.toFixed(1)}
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  value={voiceSettings.volume}
                  onChange={(e) => setVoiceSettings(prev => ({
                    ...prev,
                    volume: parseFloat(e.target.value)
                  }))}
                />
              </label>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

// Export the component
window.VoiceAssistant = VoiceAssistant;