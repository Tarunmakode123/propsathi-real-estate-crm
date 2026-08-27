'use client';

import React, { useEffect, useState } from 'react';
import Navigation from '@/components/navigation';
import { Plus, Home, MapPin, DollarSign, Bed, Bath, ArrowUpRight, Search, FileText } from 'lucide-react';

interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  location: string;
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
  createdAt: string;
}

export default function ListingsPage() {
  const [tenantId, setTenantId] = useState<string>('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [bedrooms, setBedrooms] = useState('2');
  const [bathrooms, setBathrooms] = useState('2');
  const [propertyType, setPropertyType] = useState('apartment');

  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const id = localStorage.getItem('tenantId');
    if (id) {
      setTenantId(id);
      fetchListings(id);
    }
  }, []);

  const fetchListings = async (id: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/listings?tenantId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setListings(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !price || !location || saving) return;

    try {
      setSaving(true);
      const res = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          title,
          description,
          price: Number(price),
          location,
          bedrooms: Number(bedrooms),
          bathrooms: Number(bathrooms),
          propertyType,
        }),
      });

      if (res.ok) {
        // Reset form
        setTitle('');
        setDescription('');
        setPrice('');
        setLocation('');
        setBedrooms('2');
        setBathrooms('2');
        setPropertyType('apartment');
        setShowAddForm(false);
        fetchListings(tenantId);
      } else {
        const err = await res.json();
        alert(`Failed to save listing: ${err.error || res.statusText}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error while saving listing');
    } finally {
      setSaving(false);
    }
  };

  const filteredListings = listings.filter((listing) => {
    const query = searchQuery.toLowerCase();
    return (
      listing.title.toLowerCase().includes(query) ||
      listing.location.toLowerCase().includes(query) ||
      listing.propertyType.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <Navigation />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Header section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Home className="w-6 h-6 text-indigo-400" />
              Property Inventory
            </h1>
            <p className="text-xs text-slate-400">
              Manage listings that the AI processing layer matches dynamically for incoming leads.
            </p>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-indigo-600/10"
          >
            <Plus className="w-4 h-4" />
            {showAddForm ? 'View Inventory' : 'Add Property'}
          </button>
        </div>

        {showAddForm ? (
          /* Add Listing Form Card */
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 max-w-2xl mx-auto shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">
              Create New Property Listing
            </h3>

            <form onSubmit={handleAddListing} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-slate-400 font-semibold uppercase">Property Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Modern 3 BHK Apartment with Balcony"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold uppercase">Price (Monthly Rent / Val)</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 45000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold uppercase">Location / Area</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Indiranagar, Bangalore"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-400 font-semibold uppercase">Property Type</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="apartment">Apartment</option>
                    <option value="house">Independent House</option>
                    <option value="villa">Luxury Villa</option>
                    <option value="commercial">Commercial Space</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold uppercase">Beds</label>
                    <input
                      type="number"
                      value={bedrooms}
                      onChange={(e) => setBedrooms(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400 font-semibold uppercase">Baths</label>
                    <input
                      type="number"
                      value={bathrooms}
                      onChange={(e) => setBathrooms(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-slate-400 font-semibold uppercase">Description</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter detailed property specifications, features, key nearby areas..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-slate-700 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-600/10 flex items-center gap-1.5"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Vectorizing...
                    </>
                  ) : (
                    'Save Property & Auto-Vectorize'
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Inventory Listings List */
          <div className="space-y-4">
            
            {/* Search Bar */}
            <div className="max-w-md bg-slate-950 border border-slate-700 rounded-xl flex items-center px-3.5 py-1.5">
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder="Search by title, location or property type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-0 focus:ring-0 px-2 py-1 text-xs outline-none text-slate-200 placeholder-slate-500"
              />
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-24">
                <div className="w-8 h-8 border-3 border-slate-800 border-t-indigo-500 rounded-full animate-spin"></div>
              </div>
            ) : filteredListings.length === 0 ? (
              <div className="text-center py-20 bg-slate-800/40 border border-dashed border-slate-700 rounded-2xl p-6 text-slate-500 text-sm">
                No properties in inventory matching the query. Click "Add Property" to create one.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                {filteredListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="bg-slate-800 border border-slate-700/80 rounded-2xl overflow-hidden hover:border-slate-600 transition-all flex flex-col h-full shadow-lg group"
                  >
                    <div className="p-5 flex-1 space-y-3">
                      <div className="flex justify-between items-start gap-3">
                        <span className="px-2 py-0.5 bg-indigo-950 text-indigo-400 border border-indigo-900 rounded text-[9px] font-bold uppercase tracking-wider">
                          {listing.propertyType}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(listing.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="font-bold text-slate-100 group-hover:text-indigo-400 transition-colors line-clamp-1">
                          {listing.title}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          {listing.location}
                        </div>
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">
                        {listing.description}
                      </p>
                    </div>

                    <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-4 text-slate-300">
                        <span className="flex items-center gap-1 text-[11px]">
                          <Bed className="w-4 h-4 text-slate-500" />
                          {listing.bedrooms} BHK
                        </span>
                        <span className="flex items-center gap-1 text-[11px]">
                          <Bath className="w-4 h-4 text-slate-500" />
                          {listing.bathrooms} Bath
                        </span>
                      </div>

                      <span className="text-sm font-extrabold text-indigo-400">
                        ${Number(listing.price).toLocaleString()}/mo
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
