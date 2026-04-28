import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, X, Bot, Paperclip, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ChatBotIA = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { id: 1, text: "Olá! Sou o assistente de TI da OAB. Como posso te ajudar hoje?", sender: 'bot' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = { id: Date.now(), text: input, sender: 'user' };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const API_URL = import.meta.env.VITE_BOT_API_URL || 'http://192.168.0.253:3001';
            const response = await fetch(`${API_URL}/api/bot/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: input })
            });

            const data = await response.json();
            
            if (response.ok) {
                setMessages(prev => [...prev, { 
                    id: Date.now() + 1, 
                    text: data.answer, 
                    sender: 'bot',
                    sources: data.sources 
                }]);
            } else {
                throw new Error(data.error || 'Falha na resposta');
            }
        } catch (error) {
            setMessages(prev => [...prev, { 
                id: Date.now() + 1, 
                text: "Desculpe, tive um problema técnico. Tente novamente em instantes.", 
                sender: 'bot' 
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {/* Bubble Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className="w-14 h-14 bg-accent rounded-full flex items-center justify-center text-white shadow-2xl transition-all duration-300 hover:shadow-accent/40"
                style={{ backgroundColor: 'var(--accent)' }}
            >
                {isOpen ? <X size={24} /> : <Bot size={28} />}
            </motion.button>

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="absolute bottom-20 right-0 w-[400px] max-w-[90vw] h-[600px] rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden border"
                        style={{ 
                            backgroundColor: '#111111', 
                            borderColor: 'var(--accent)',
                            zIndex: 1000
                        }}
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-white/5 flex items-center justify-between" style={{ backgroundColor: '#111111', borderBottom: '1px solid var(--bg-soft)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent">
                                    <Bot size={22} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-main" style={{ color: 'var(--text-main)' }}>Antigravity Bot</h3>
                                    <p className="text-[10px] text-muted uppercase tracking-widest font-bold" style={{ color: 'var(--text-muted)' }}>Suporte Inteligente</p>
                                </div>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${
                                        msg.sender === 'user' 
                                            ? 'bg-accent text-white rounded-tr-none' 
                                            : 'bg-soft text-main rounded-tl-none border border-white/5'
                                    }`}
                                    style={{ 
                                        backgroundColor: msg.sender === 'user' ? 'var(--accent)' : 'var(--bg-soft)',
                                        color: msg.sender === 'user' ? 'white' : 'var(--text-main)'
                                    }}>
                                        <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>
                                        {msg.sources && msg.sources.length > 0 && (
                                            <div className="mt-3 pt-3 border-t border-white/10">
                                                {msg.sources.map((src, i) => (
                                                    <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" className="text-[10px] items-center gap-1 hover:underline opacity-60">
                                                        Fonte: {src.titulo}
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-soft p-4 rounded-2xl rounded-tl-none border border-white/5" style={{ backgroundColor: 'var(--bg-soft)' }}>
                                        <Loader2 size={16} className="animate-spin text-muted" style={{ color: 'var(--text-muted)' }} />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-6 border-t border-white/5" style={{ backgroundColor: '#111111', borderTop: '1px solid var(--bg-soft)' }}>
                            <div className="flex items-center gap-2 bg-soft rounded-2xl p-2 pl-4 border" style={{ backgroundColor: 'var(--bg-soft)', borderColor: 'var(--bg-soft)' }}>
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Pergunte algo..."
                                    className="flex-1 bg-transparent border-none outline-none text-sm py-2 text-main"
                                    style={{ color: 'var(--text-main)' }}
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={isLoading || !input.trim()}
                                    className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white disabled:opacity-50 transition-all hover:scale-105"
                                    style={{ backgroundColor: 'var(--accent)' }}
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ChatBotIA;
