'use client';

import React, { useEffect, useState } from 'react';
import Navigation from '@/components/navigation';
import { Settings, Shield, Plus, MessageCircle, MessageSquare, Link2, Copy, Check, Info } from 'lucide-react';

interface Connector {
  id: string;
  platform: string;
  name: string;
  externalId: string | null;
  config: Record<string, any>;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [tenantId, setTenantId] = useState<string>('');
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms state
  const [showAddForm, setShowAddForm] = useState(false);
  const [platform, setPlatform] = useState('telegram');
  const [name, setName] = useState('');
  const [externalId, setExternalId] = useState('');

  // WhatsApp-specific state
  const [waPhoneId, setWaPhoneId] = useState('');
  const [waWabaId, setWaWabaId] = useState('');
  const [waToken, setWaToken] = useState('');
  const [waSecret, setWaSecret] = useState('');

  // Telegram-specific state
  const [tgBotToken, setTgBotToken] = useState('');
  const [tgSecretToken, setTgSecretToken] = useState('');
  const [tgUsername, setTgUsername] = useState('');

  // Facebook Messenger-specific state
  const [fbPageId, setFbPageId] = useState('');
  const [fbToken, setFbToken] = useState('');
  const [fbSecret, setFbSecret] = useState('');

  // Instagram-specific state
  const [igAccountId, setIgAccountId] = useState('');
  const [igToken, setIgToken] = useState('');
  const [igSecret, setIgSecret] = useState('');

  // Generic Webhook-specific state
  const [genericSecret, setGenericSecret] = useState('');

  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem('tenantId');
    if (id) {
      setTenantId(id);
      fetchConnectors(id);
    }
  }, []);

  const fetchConnectors = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/connectors?tenantId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setConnectors(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddConnector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || saving) return;

    try {
      setSaving(true);
      
      let credentials = {};
      let config = {};

      if (platform === 'whatsapp') {
        credentials = {
          accessToken: waToken,
          appSecret: waSecret,
        };
        config = {
          phoneNumberId: waPhoneId,
          wabaId: waWabaId,
          autoRespond: true,
          tone: 'professional, helpful, and courteous',
        };
      } else if (platform === 'telegram') {
        credentials = {
          botToken: tgBotToken,
          secretToken: tgSecretToken || 'propsathi_tg_secret',
        };
        config = {
          botUsername: tgUsername,
          autoRespond: true,
          tone: 'friendly, direct, and enthusiastic',
        };
      } else if (platform === 'facebook') {
        credentials = {
          accessToken: fbToken,
          appSecret: fbSecret,
        };
        config = {
          pageId: fbPageId,
          autoRespond: true,
          tone: 'professional and courteous',
        };
      } else if (platform === 'instagram') {
        credentials = {
          accessToken: igToken,
          appSecret: igSecret,
        };
        config = {
          instagramId: igAccountId,
          autoRespond: true,
          tone: 'casual, helpful, and fast',
        };
      } else if (platform === 'generic') {
        credentials = {
          secretToken: genericSecret || 'propsathi_generic_secret',
        };
        config = {
          autoRespond: false,
        };
      }

      const res = await fetch('/api/connectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          platform,
          name,
          externalId:
            platform === 'whatsapp' ? waPhoneId :
            platform === 'telegram' ? tgUsername :
            platform === 'facebook' ? fbPageId :
            platform === 'instagram' ? igAccountId :
            `generic_${Date.now()}`,
          config,
          credentials,
        }),
      });

      if (res.ok) {
        setName('');
        setExternalId('');
        setWaPhoneId('');
        setWaWabaId('');
        setWaToken('');
        setWaSecret('');
        setTgBotToken('');
        setTgSecretToken('');
        setTgUsername('');
        setFbPageId('');
        setFbToken('');
        setFbSecret('');
        setIgAccountId('');
        setIgToken('');
        setIgSecret('');
        setGenericSecret('');
        setShowAddForm(false);
        fetchConnectors(tenantId);
      } else {
        const err = await res.json();
        alert(`Failed to save integration: ${err.error || res.statusText}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error while saving integration');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(key);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getWebhookUrl = (connector: Connector) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
    if (connector.platform === 'whatsapp') {
      return `${origin}/api/webhooks/whatsapp`;
    }
    return `${origin}/api/webhooks/${connector.platform}?connectorId=${connector.id}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Settings className="w-6 h-6 text-indigo-655/90" />
              Integrations & Settings
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Configure communication channels. Encrypted API tokens are decrypted only during request routing.
            </p>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/10"
          >
            <Plus className="w-4 h-4" />
            {showAddForm ? 'View Connections' : 'Link Channel'}
          </button>
        </div>

        {showAddForm ? (
          /* Add Connector Form Card */
          <div className="bg-white border border-slate-100 rounded-2xl p-6 max-w-xl mx-auto shadow-xl shadow-slate-200/30">
            <h3 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">
              Configure New Platform Connection
            </h3>

            <form onSubmit={handleAddConnector} className="space-y-4">
              {/* Platform selection */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-bold uppercase">Channel Type</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => { setPlatform('telegram'); setName('Telegram bot'); }}
                    className={`py-3 px-4 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                      platform === 'telegram'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700'
                        : 'border-slate-150 bg-slate-50 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <MessageSquare className="w-5 h-5 text-sky-500 shrink-0" />
                    <div>
                      <p className={`text-xs font-bold ${platform === 'telegram' ? 'text-indigo-700' : 'text-slate-700'}`}>Telegram Bot</p>
                      <p className="text-[10px] text-slate-400 font-medium">Fast, free sandbox test</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setPlatform('whatsapp'); setName('WhatsApp Business'); }}
                    className={`py-3 px-4 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                      platform === 'whatsapp'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700'
                        : 'border-slate-150 bg-slate-50 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <MessageCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div>
                      <p className={`text-xs font-bold ${platform === 'whatsapp' ? 'text-indigo-700' : 'text-slate-700'}`}>WhatsApp Business</p>
                      <p className="text-[10px] text-slate-400 font-medium">Official Cloud API</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setPlatform('facebook'); setName('Facebook Page Messenger'); }}
                    className={`py-3 px-4 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                      platform === 'facebook'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700'
                        : 'border-slate-150 bg-slate-50 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <MessageSquare className="w-5 h-5 text-blue-500 shrink-0" />
                    <div>
                      <p className={`text-xs font-bold ${platform === 'facebook' ? 'text-indigo-700' : 'text-slate-700'}`}>Facebook Messenger</p>
                      <p className="text-[10px] text-slate-400 font-medium">Page Chat Channel</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setPlatform('instagram'); setName('Instagram Direct'); }}
                    className={`py-3 px-4 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                      platform === 'instagram'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700'
                        : 'border-slate-150 bg-slate-50 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <MessageCircle className="w-5 h-5 text-pink-500 shrink-0" />
                    <div>
                      <p className={`text-xs font-bold ${platform === 'instagram' ? 'text-indigo-700' : 'text-slate-700'}`}>Instagram DM</p>
                      <p className="text-[10px] text-slate-400 font-medium">Direct Messaging</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setPlatform('generic'); setName('Custom JSON Webhook'); }}
                    className={`py-3 px-4 rounded-xl border text-left transition-all flex items-center gap-2.5 sm:col-span-2 ${
                      platform === 'generic'
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700'
                        : 'border-slate-150 bg-slate-50 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    <Link2 className="w-5 h-5 text-amber-500 shrink-0" />
                    <div>
                      <p className={`text-xs font-bold ${platform === 'generic' ? 'text-indigo-700' : 'text-slate-700'}`}>Custom HTTP Webhook</p>
                      <p className="text-[10px] text-slate-400 font-medium">Ingest raw JSON payloads from any lead portal</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Friendly Name */}
              <div className="space-y-1">
                <label className="text-xs text-slate-400 font-bold uppercase">Connection Label / Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sales Team WhatsApp"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                />
              </div>

              {/* Platform Specific Fields */}
              {platform === 'whatsapp' && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">WhatsApp Phone Number ID</label>
                    <input
                      type="text"
                      required
                      value={waPhoneId}
                      onChange={(e) => setWaPhoneId(e.target.value)}
                      placeholder="e.g. 103982392830239"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">WABA Account ID</label>
                    <input
                      type="text"
                      required
                      value={waWabaId}
                      onChange={(e) => setWaWabaId(e.target.value)}
                      placeholder="e.g. 298382918239283"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Meta System User Access Token</label>
                    <input
                      type="password"
                      required
                      value={waToken}
                      onChange={(e) => setWaToken(e.target.value)}
                      placeholder="Permanent token (starts with EAA...)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Meta App Secret (for webhook validation)</label>
                    <input
                      type="password"
                      required
                      value={waSecret}
                      onChange={(e) => setWaSecret(e.target.value)}
                      placeholder="Find in app basic settings panel"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              )}

              {platform === 'telegram' && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Telegram Bot Username</label>
                    <input
                      type="text"
                      required
                      value={tgUsername}
                      onChange={(e) => setTgUsername(e.target.value)}
                      placeholder="e.g. PropSathiDemoBot (do not include @)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Bot API Token</label>
                    <input
                      type="password"
                      required
                      value={tgBotToken}
                      onChange={(e) => setTgBotToken(e.target.value)}
                      placeholder="e.g. 738291047:AAHdfy983yhad8h9has8dhy83ha9d8"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Secret Webhook Token (Optional)</label>
                    <input
                      type="text"
                      value={tgSecretToken}
                      onChange={(e) => setTgSecretToken(e.target.value)}
                      placeholder="propsathi_tg_secret"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              )}

              {platform === 'facebook' && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Facebook Page ID</label>
                    <input
                      type="text"
                      required
                      value={fbPageId}
                      onChange={(e) => setFbPageId(e.target.value)}
                      placeholder="e.g. 104829102839281"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Page Access Token</label>
                    <input
                      type="password"
                      required
                      value={fbToken}
                      onChange={(e) => setFbToken(e.target.value)}
                      placeholder="Permanent Page Access Token (EAA...)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Meta App Secret</label>
                    <input
                      type="password"
                      required
                      value={fbSecret}
                      onChange={(e) => setFbSecret(e.target.value)}
                      placeholder="Find in app basic settings panel"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              )}

              {platform === 'instagram' && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Instagram Professional ID</label>
                    <input
                      type="text"
                      required
                      value={igAccountId}
                      onChange={(e) => setIgAccountId(e.target.value)}
                      placeholder="e.g. 1784140539283921"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Page Access Token (Linked page)</label>
                    <input
                      type="password"
                      required
                      value={igToken}
                      onChange={(e) => setIgToken(e.target.value)}
                      placeholder="Permanent Page Access Token (EAA...)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Meta App Secret</label>
                    <input
                      type="password"
                      required
                      value={igSecret}
                      onChange={(e) => setIgSecret(e.target.value)}
                      placeholder="App Secret from basic settings"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>
              )}

              {platform === 'generic' && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-bold uppercase">Secret Webhook Token (Optional)</label>
                    <input
                      type="text"
                      value={genericSecret}
                      onChange={(e) => setGenericSecret(e.target.value)}
                      placeholder="propsathi_generic_secret"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
                    />
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-[10px] text-slate-500 space-y-1">
                    <span className="font-bold text-slate-700">💡 Custom Integration Info:</span>
                    <p>Once linked, we will generate a dedicated Inbound Webhook URL. You can send any POST payload with lead data to it, and our AI processor will parse it automatically.</p>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-750 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/10 flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Encrypting & Saving...
                    </>
                  ) : (
                    'Link Integration'
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Connectors Listings Card */
          <div className="space-y-6">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="w-8 h-8 border-3 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            ) : connectors.length === 0 ? (
              <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl p-6 text-slate-400 font-medium">
                No active platform integrations connected yet. Click "Link Channel" to connect your first bot.
              </div>
            ) : (
              <div className="space-y-4">
                {connectors.map((connector) => {
                  const url = getWebhookUrl(connector);
                  const isCopied = copiedId === connector.id;
                  
                  return (
                    <div
                      key={connector.id}
                      className="bg-white border border-slate-100 rounded-2xl p-5 space-y-4 shadow-sm hover:border-slate-200 hover:shadow-md hover:shadow-slate-200/50 transition-all"
                    >
                      {/* Top Row: Name and status badge */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center">
                            {connector.platform === 'whatsapp' ? (
                              <MessageCircle className="w-5 h-5 text-emerald-500" />
                            ) : (
                              <MessageSquare className="w-5 h-5 text-sky-500" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 flex items-center gap-2 text-sm sm:text-base">
                              {connector.name}
                              <span className="text-[10px] text-slate-450 font-semibold">
                                ({connector.platform.toUpperCase()})
                              </span>
                            </h4>
                            <p className="text-[10px] text-slate-400 font-mono">External ID: {connector.externalId || 'None'}</p>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-full border ${
                          connector.status === 'active'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : 'bg-red-50 text-red-655 border-red-100'
                        }`}>
                          {connector.status}
                        </span>
                      </div>

                      {/* Webhook Configuration URL Card */}
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          <span className="flex items-center gap-1">
                            <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                            Inbound Webhook Url
                          </span>
                          <button
                            onClick={() => copyToClipboard(url, connector.id)}
                            className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-bold uppercase"
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                Copy URL
                              </>
                            )}
                          </button>
                        </div>
                        
                        <div className="font-mono text-xs text-slate-600 break-all select-all py-1 bg-white px-2 rounded border border-slate-150">
                          {url}
                        </div>

                        {connector.platform === 'telegram' && (
                          <div className="flex gap-1.5 items-start text-[10px] text-slate-500 leading-normal pt-1 border-t border-slate-200/60 mt-1">
                            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <p>
                              Set this webhook on your bot using Telegram API: <br />
                              <span className="font-mono text-[9px] text-slate-550 select-all">
                                https://api.telegram.org/bot&lt;BOT_TOKEN&gt;/setWebhook?url={encodeURIComponent(url)}
                              </span>
                            </p>
                          </div>
                        )}
                        
                        {connector.platform === 'whatsapp' && (
                          <div className="flex gap-1.5 items-start text-[10px] text-slate-500 leading-normal pt-1 border-t border-slate-200/60 mt-1">
                            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <p>
                              Enter this URL in Meta Developer portal under <strong>Webhooks</strong>. Set verify token parameter to: <code className="text-slate-500 font-mono bg-white px-1 py-0.5 rounded border border-slate-150">propsathi_meta_secret_2026</code>.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cryptography notice card */}
            <div className="bg-indigo-50/40 border border-indigo-100/60 rounded-2xl p-4 flex gap-3 text-xs text-slate-655/90">
              <Shield className="w-5 h-5 text-indigo-650 shrink-0" />
              <div>
                <h5 className="font-bold text-indigo-850 mb-0.5">Secure Credentials Storage</h5>
                <p className="leading-relaxed text-slate-500">
                  Your API keys and auth secrets are encrypted using AES-256-GCM. We generate a unique initialization vector (IV) per record to prevent credential fingerprinting. System processes decrypt keys into transient memory only at the time of outgoing message dispatch.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
