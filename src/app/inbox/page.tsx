'use client';

import React, { useEffect, useState } from 'react';
import Navigation from '@/components/navigation';
import { 
  MessageSquare, Send, Bot, Check, User, Flame, 
  MessageCircle, HelpCircle, Phone, Mail, Award, MapPin, 
  DollarSign, Home, AlertCircle, PlusCircle, RefreshCw
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Lead {
  id: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  status: string;
  score: 'hot' | 'warm' | 'cold' | null;
  scoreReasoning: string | null;
  sourcePlatform: string;
  sourceLeadId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  direction: 'inbound' | 'outbound';
  platform: string;
  content: string;
  aiProcessed: boolean;
  aiClassification: {
    intent: string;
    score: string;
    reasoning: string;
    extracted_parameters?: {
      budget?: number;
      location?: string;
      bedrooms?: number;
    };
  } | null;
  aiDraftReply: string | null;
  aiDraftStatus: 'none' | 'pending_approval' | 'approved' | 'rejected' | 'auto_sent';
  createdAt: string;
}

interface Listing {
  id: string;
  title: string;
  location: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
}

export default function InboxPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string>('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  // Right side matched listings (based on extraction)
  const [matchedListings, setMatchedListings] = useState<Listing[]>([]);

  // Reply state
  const [replyText, setReplyText] = useState('');
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [editedDraftText, setEditedDraftText] = useState('');

  // Mock message generator states
  const [showMockModal, setShowMockModal] = useState(false);
  const [mockPlatform, setMockPlatform] = useState('telegram');
  const [mockSenderName, setMockSenderName] = useState('Rohan Sharma');
  const [mockSenderPhone, setMockSenderPhone] = useState('+919876543210');
  const [mockMessageContent, setMockMessageContent] = useState('Looking for a 3BHK flat in Indiranagar under 1.5 Lacs');

  const [loadingLeads, setLoadingLeads] = useState(true);
  const [sendingReply, setSendingReply] = useState(false);
  const [triggeringMock, setTriggeringMock] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        setTenantId(data.user.tenantId);
        localStorage.setItem('tenantId', data.user.tenantId);
        localStorage.setItem('tenantName', data.user.tenantName);
        fetchLeads(data.user.tenantId);
      } catch (err) {
        router.push('/login');
      }
    }
    checkAuth();
  }, []);

  useEffect(() => {
    if (tenantId && selectedLeadId) {
      fetchLeadDetails(selectedLeadId);
      // Poll message history
      const interval = setInterval(() => {
        fetchMessages(selectedLeadId);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [tenantId, selectedLeadId]);

  const fetchLeads = async (id: string) => {
    try {
      setLoadingLeads(true);
      const res = await fetch(`/api/leads?tenantId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
        if (data.length > 0 && !selectedLeadId) {
          setSelectedLeadId(data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLeads(false);
    }
  };

  const fetchMessages = async (leadId: string) => {
    try {
      const res = await fetch(`/api/messages?tenantId=${tenantId}&leadId=${leadId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeadDetails = async (leadId: string) => {
    try {
      const res = await fetch(`/api/leads?tenantId=${tenantId}&leadId=${leadId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedLead(data);
        if (data.messages) {
          setMessages(data.messages);
          // Look for any AI classified details and fetch listings
          const inboundAI = data.messages.find(
            (m: any) => m.direction === 'inbound' && m.aiClassification
          );
          if (inboundAI && inboundAI.aiClassification.extracted_parameters) {
            fetchMatchedListings(inboundAI.aiClassification.extracted_parameters);
          } else {
            setMatchedListings([]);
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMatchedListings = async (params: any) => {
    // Simple fetch listings with filtering, or fallback to general listings
    try {
      const res = await fetch(`/api/listings?tenantId=${tenantId}`);
      if (res.ok) {
        const data = await res.json() as Listing[];
        // Filter based on extracted parameters client-side as fallback to semantic vector search
        let filtered = data;
        if (params.location) {
          filtered = filtered.filter(l => l.location.toLowerCase().includes(params.location.toLowerCase()));
        }
        if (params.bedrooms) {
          filtered = filtered.filter(l => l.bedrooms === Number(params.bedrooms));
        }
        setMatchedListings(filtered.slice(0, 3));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedLeadId || sendingReply) return;

    try {
      setSendingReply(true);
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          action: 'send',
          leadId: selectedLeadId,
          content: replyText,
        }),
      });

      if (res.ok) {
        setReplyText('');
        fetchMessages(selectedLeadId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSendingReply(false);
    }
  };

  const handleApproveDraft = async (messageId: string, customText?: string) => {
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          action: 'approve_draft',
          messageId,
          editedContent: customText,
        }),
      });

      if (res.ok) {
        setEditingDraftId(null);
        fetchMessages(selectedLeadId!);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateLeadStatus = async (status: string) => {
    if (!selectedLeadId) return;
    try {
      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          leadId: selectedLeadId,
          status,
        }),
      });
      if (res.ok) {
        fetchLeads(tenantId);
        setSelectedLead(prev => prev ? { ...prev, status } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateLeadScore = async (score: string) => {
    if (!selectedLeadId) return;
    try {
      const res = await fetch('/api/leads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          leadId: selectedLeadId,
          score,
        }),
      });
      if (res.ok) {
        fetchLeads(tenantId);
        setSelectedLead(prev => prev ? { ...prev, score: score as any } : null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerMockLead = async () => {
    try {
      setTriggeringMock(true);
      
      // We will look up if there is a connector of this platform
      const connectorsRes = await fetch(`/api/connectors?tenantId=${tenantId}`);
      const connectors = await connectorsRes.json();
      const connector = connectors.find((c: any) => c.platform === mockPlatform);

      if (!connector) {
        alert(`Please connect a ${mockPlatform} connector in Settings first before testing mock webhook.`);
        setTriggeringMock(false);
        return;
      }

      // Generate webhook payload format based on platform
      let payload = {};
      const secretToken = 'propsathi_tg_secret';
      let headers: Record<string, string> = {};

      if (mockPlatform === 'telegram') {
        headers = { 'X-Telegram-Bot-Api-Secret-Token': secretToken };
        payload = {
          update_id: 123456,
          message: {
            message_id: Math.floor(Math.random() * 1000),
            from: {
              id: 999999,
              first_name: mockSenderName.split(' ')[0],
              last_name: mockSenderName.split(' ')[1] || '',
              username: mockSenderName.toLowerCase().replace(' ', ''),
            },
            chat: {
              id: 999999,
              first_name: mockSenderName.split(' ')[0],
              type: 'private',
            },
            text: mockMessageContent,
            date: Math.floor(Date.now() / 1000),
          },
        };
      } else if (mockPlatform === 'whatsapp') {
        headers = { 'X-Propsathi-Mock': 'propsathi_meta_secret_2026' };
        payload = {
          object: 'whatsapp_business_account',
          entry: [
            {
              id: '106294892302324',
              changes: [
                {
                  value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                      display_phone_number: '15550550005',
                      phone_number_id: connector.externalId || '103982392830239',
                    },
                    contacts: [
                      {
                        profile: { name: mockSenderName },
                        wa_id: mockSenderPhone.replace('+', ''),
                      },
                    ],
                    messages: [
                      {
                        from: mockSenderPhone.replace('+', ''),
                        id: `wamid.MOCK_${Math.random().toString(36).substring(7)}`,
                        timestamp: Math.floor(Date.now() / 1000).toString(),
                        text: { body: mockMessageContent },
                        type: 'text',
                      },
                    ],
                  },
                  field: 'messages',
                },
              ],
            },
          ],
        };
      }

      // POST to our webhook URL
      const res = await fetch(`/api/webhooks/${mockPlatform}?connectorId=${connector.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowMockModal(false);
        // Refresh leads list after 1.5 seconds to let AI finish
        setTimeout(() => {
          fetchLeads(tenantId);
          if (selectedLeadId) fetchLeadDetails(selectedLeadId);
        }, 1500);
      } else {
        const err = await res.json();
        alert(`Webhook mock fail: ${err.error || res.statusText}`);
      }
    } catch (error) {
      console.error(error);
      alert('Mock trigger execution error');
    } finally {
      setTriggeringMock(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'whatsapp':
        return <MessageCircle className="w-4 h-4 text-emerald-400" />;
      case 'telegram':
        return <MessageSquare className="w-4 h-4 text-sky-400" />;
      default:
        return <HelpCircle className="w-4 h-4 text-slate-400" />;
    }
  };

  const getScoreBadge = (score: string | null) => {
    switch (score?.toLowerCase()) {
      case 'hot':
        return (
          <span className="px-2 py-0.5 bg-red-950 text-red-400 border border-red-800 rounded-full text-[10px] font-bold flex items-center gap-1">
            <Flame className="w-3 h-3 fill-red-400 text-red-400" />
            HOT
          </span>
        );
      case 'warm':
        return (
          <span className="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800 rounded-full text-[10px] font-bold">
            WARM
          </span>
        );
      case 'cold':
        return (
          <span className="px-2 py-0.5 bg-slate-900 text-slate-400 border border-slate-700 rounded-full text-[10px] font-bold">
            COLD
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <Navigation />

      {/* Main Layout Grid */}
      <div className="flex-1 flex overflow-hidden h-[calc(100vh-4rem)]">
        
        {/* Left Pane: Leads List */}
        <aside className="w-80 border-r border-slate-200 flex flex-col bg-white">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              Leads Ingested
              <button 
                onClick={() => fetchLeads(tenantId)} 
                className="p-1 hover:bg-slate-100 rounded transition-all text-slate-500 hover:text-slate-800"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </h2>

            <button
              onClick={() => setShowMockModal(true)}
              className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded flex items-center gap-1 font-semibold transition-all shadow-sm shadow-indigo-600/10"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Test Incoming
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loadingLeads ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            ) : leads.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs font-medium">
                No leads ingested yet. Use "Test Incoming" to submit a mock message.
              </div>
            ) : (
              leads.map((lead) => {
                const isSelected = selectedLeadId === lead.id;
                return (
                  <button
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className={`w-full text-left p-4 transition-all flex flex-col gap-1.5 border-l-4 ${
                      isSelected 
                        ? 'bg-indigo-50/30 border-indigo-600 font-semibold' 
                        : 'border-transparent hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 truncate">
                        {getPlatformIcon(lead.sourcePlatform)}
                        {lead.contactName || 'Anonymous Contact'}
                      </div>
                      <span className="text-[9px] text-slate-400 font-medium">
                        {new Date(lead.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded ${
                        lead.status === 'new' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                        lead.status === 'contacted' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                        lead.status === 'qualified' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {lead.status.toUpperCase()}
                      </span>
                      {getScoreBadge(lead.score)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Center Pane: Conversations History */}
        <section className="flex-1 flex flex-col bg-slate-50/50 border-r border-slate-200">
          {selectedLeadId ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm">
                <div>
                  <h3 className="font-bold text-slate-800">
                    {selectedLead?.contactName || 'Chat Log'}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Channel: {selectedLead?.sourcePlatform.toUpperCase()} | Address: {selectedLead?.sourceLeadId}
                  </p>
                </div>
              </div>

              {/* Chat Bubbles */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col">
                {messages.map((message) => {
                  const isInbound = message.direction === 'inbound';
                  const isPendingDraft = message.aiDraftStatus === 'pending_approval' && message.aiDraftReply;
                  
                  return (
                    <div key={message.id} className="space-y-2">
                      {/* Main Message Bubble */}
                      <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-md p-3.5 rounded-2xl text-sm leading-relaxed ${
                          isInbound 
                            ? 'bg-white text-slate-800 border border-slate-100 shadow-sm rounded-tl-none' 
                            : 'bg-indigo-600 text-white rounded-tr-none'
                        }`}>
                          <p>{message.content}</p>
                          <span className={`block text-[9px] mt-1.5 text-right ${
                            isInbound ? 'text-slate-400 font-medium' : 'text-indigo-200 font-medium'
                          }`}>
                            {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>

                      {/* AI Response Card - Display directly underneath the triggering inbound message */}
                      {isInbound && message.aiProcessed && (
                        <div className="max-w-md mx-auto sm:ml-6 bg-white border border-indigo-100/80 shadow-sm shadow-indigo-600/5 rounded-xl p-4 space-y-3">
                          <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                            <span className="text-indigo-600 font-bold flex items-center gap-1.5">
                              <Bot className="w-4 h-4 text-indigo-600" />
                              PropSathi AI Triage Layer
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Intent: {message.aiClassification?.intent.toUpperCase()}
                            </span>
                          </div>

                          <div className="text-xs space-y-1">
                            <span className="text-slate-500 font-semibold">Extracted Criteria:</span>
                            <div className="flex gap-2 flex-wrap text-[10px]">
                              {message.aiClassification?.extracted_parameters?.location && (
                                <span className="bg-slate-50 text-slate-600 border border-slate-100 font-medium px-2 py-0.5 rounded">
                                  Loc: {message.aiClassification.extracted_parameters.location}
                                </span>
                              )}
                              {message.aiClassification?.extracted_parameters?.budget && (
                                <span className="bg-slate-50 text-slate-600 border border-slate-100 font-medium px-2 py-0.5 rounded">
                                  Budget: ${message.aiClassification.extracted_parameters.budget}
                                </span>
                              )}
                              {message.aiClassification?.extracted_parameters?.bedrooms && (
                                <span className="bg-slate-50 text-slate-600 border border-slate-100 font-medium px-2 py-0.5 rounded">
                                  Beds: {message.aiClassification.extracted_parameters.bedrooms} BHK
                                </span>
                              )}
                              {!message.aiClassification?.extracted_parameters?.location && 
                               !message.aiClassification?.extracted_parameters?.budget && 
                               !message.aiClassification?.extracted_parameters?.bedrooms && (
                                <span className="text-slate-400 italic">None extracted</span>
                              )}
                            </div>
                          </div>

                          {/* Draft Output */}
                          {message.aiDraftReply && (
                            <div className="space-y-2">
                              <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs leading-relaxed text-slate-700">
                                {editingDraftId === message.id ? (
                                  <textarea
                                    className="w-full bg-transparent border-0 focus:ring-0 p-0 text-slate-800 outline-none resize-y min-h-[60px]"
                                    value={editedDraftText}
                                    onChange={(e) => setEditedDraftText(e.target.value)}
                                  />
                                ) : (
                                  <p>{message.aiDraftReply}</p>
                                )}
                              </div>

                              {/* Action buttons based on status */}
                              {message.aiDraftStatus === 'pending_approval' && (
                                <div className="flex gap-2 justify-end">
                                  {editingDraftId === message.id ? (
                                    <>
                                      <button
                                        onClick={() => setEditingDraftId(null)}
                                        className="px-2.5 py-1 text-slate-500 hover:text-slate-700 text-xs font-semibold"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleApproveDraft(message.id, editedDraftText)}
                                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center gap-1"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        Save & Send
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => {
                                          setEditingDraftId(message.id);
                                          setEditedDraftText(message.aiDraftReply || '');
                                        }}
                                        className="px-2.5 py-1 border border-slate-200 hover:bg-slate-50 rounded text-slate-600 text-xs font-semibold transition-all"
                                      >
                                        Edit Draft
                                      </button>
                                      <button
                                        onClick={() => handleApproveDraft(message.id)}
                                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-sm shadow-indigo-600/10 transition-all"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        Approve & Send
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}

                              {message.aiDraftStatus === 'approved' && (
                                <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 justify-end">
                                  <Check className="w-3.5 h-3.5" /> Approved & Sent by Agent
                                </div>
                              )}
                              
                              {message.aiDraftStatus === 'auto_sent' && (
                                <div className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1 justify-end">
                                  <Check className="w-3.5 h-3.5" /> Automatically Dispatched (Confidence High)
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Reply Input Box */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white flex items-center gap-2 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
                <input
                  type="text"
                  placeholder="Type an outbound message back to lead..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-600 focus:bg-white text-slate-800 placeholder-slate-400 transition-all"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || sendingReply}
                  className="p-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white rounded-xl transition-all shadow-md shadow-indigo-600/10 flex items-center justify-center shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2 bg-white">
              <MessageSquare className="w-12 h-12 stroke-[1.5] text-slate-300" />
              <p className="text-sm font-medium">Select a conversation thread to review messages.</p>
            </div>
          )}
        </section>

        {/* Right Pane: Lead Context & Recommendations */}
        <aside className="w-80 border-l border-slate-200 flex flex-col bg-white overflow-y-auto divide-y divide-slate-100">
          {selectedLead ? (
            <>
              {/* Lead Profile */}
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200 text-slate-600 font-extrabold">
                    {selectedLead.contactName ? selectedLead.contactName.charAt(0) : 'U'}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800">{selectedLead.contactName || 'Unknown Lead'}</h4>
                    <span className="text-[10px] text-slate-400 font-medium">Workspace Member since {new Date(selectedLead.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  {selectedLead.contactPhone && (
                    <div className="flex items-center gap-2 text-slate-600 font-medium">
                      <Phone className="w-4 h-4 text-slate-400" />
                      {selectedLead.contactPhone}
                    </div>
                  )}
                  {selectedLead.contactEmail && (
                    <div className="flex items-center gap-2 text-slate-600 font-medium">
                      <Mail className="w-4 h-4 text-slate-400" />
                      {selectedLead.contactEmail}
                    </div>
                  )}
                </div>
              </div>

              {/* Status and Scoring Triage Controls */}
              <div className="p-5 space-y-3.5">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Triage Controls</h5>
                
                <div className="space-y-3">
                  {/* Pipeline Status */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">Lead Status</label>
                    <select
                      value={selectedLead.status}
                      onChange={(e) => updateLeadStatus(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white text-slate-700 font-semibold transition-all"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="won">Won / Closed</option>
                      <option value="lost">Lost</option>
                    </select>
                  </div>

                  {/* Manual Score Overrides */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase">Triage Score</label>
                    <select
                      value={selectedLead.score || ''}
                      onChange={(e) => updateLeadScore(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-600 focus:bg-white text-slate-700 font-semibold transition-all"
                    >
                      <option value="">Unrated</option>
                      <option value="hot">Hot</option>
                      <option value="warm">Warm</option>
                      <option value="cold">Cold</option>
                    </select>
                  </div>
                </div>

                {selectedLead.scoreReasoning && (
                  <div className="p-3 bg-indigo-50/50 border border-indigo-100/80 rounded-lg text-[11px] leading-relaxed text-slate-600 flex gap-2">
                    <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div>
                      <p className="font-bold text-indigo-700">AI Scoring Context:</p>
                      <p className="text-slate-600 font-medium">{selectedLead.scoreReasoning}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Matched Listings */}
              <div className="p-5 space-y-3">
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Matched Inventory</h5>
                {matchedListings.length === 0 ? (
                  <div className="text-[11px] text-slate-400 italic p-4 text-center border border-dashed border-slate-200 rounded-lg">
                    No relevant property matching criteria detected yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {matchedListings.map((listing) => (
                      <div key={listing.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-slate-200 hover:bg-slate-100/30 transition-all space-y-1.5 shadow-sm">
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-bold text-xs text-slate-800 line-clamp-1">
                            {listing.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {listing.location}
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <span className="font-extrabold text-indigo-600">${Number(listing.price)}/mo</span>
                          <span className="text-[10px] text-slate-500 font-semibold">{listing.bedrooms} BHK | {listing.propertyType.toUpperCase()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-slate-400 text-xs font-medium">
              Select a lead to inspect contexts.
            </div>
          )}
        </aside>
      </div>

      {/* Mock Webhook Modal */}
      {showMockModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-100 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-600" />
                Mock Inbound Webhook Event
              </h3>
              <button 
                onClick={() => setShowMockModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Platform Selector */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase">Platform</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMockPlatform('telegram')}
                    className={`py-2.5 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
                      mockPlatform === 'telegram'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-350'
                    }`}
                  >
                    Telegram Bot
                  </button>
                  <button
                    onClick={() => setMockPlatform('whatsapp')}
                    className={`py-2.5 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
                      mockPlatform === 'whatsapp'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700'
                        : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-350'
                    }`}
                  >
                    WhatsApp Business
                  </button>
                </div>
              </div>

              {/* Sender Name */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase">Sender Name</label>
                <input
                  type="text"
                  value={mockSenderName}
                  onChange={(e) => setMockSenderName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                />
              </div>

              {/* Sender Phone (Only for WA) */}
              {mockPlatform === 'whatsapp' && (
                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-bold uppercase">Sender WhatsApp ID (Phone)</label>
                  <input
                    type="text"
                    value={mockSenderPhone}
                    onChange={(e) => setMockSenderPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                  />
                </div>
              )}

              {/* Message Content */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase">Inbound Message</label>
                <textarea
                  rows={3}
                  value={mockMessageContent}
                  onChange={(e) => setMockMessageContent(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all resize-none"
                  placeholder="Ask for listings, budget, locations..."
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setShowMockModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={triggerMockLead}
                disabled={triggeringMock || !mockMessageContent}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-600/15"
              >
                {triggeringMock ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Triage Processing...
                  </>
                ) : (
                  <>
                    Inject Webhook Payload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
