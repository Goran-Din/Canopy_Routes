import { useState, useRef, useEffect, useCallback } from 'react';
import { createClient, updateClient } from '../api/clients.api';
import { useUIStore } from '../store/uiStore';
import type { Client } from '../types/map.types';

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientAdded: (client: Client) => void;
  initialData?: Client | null;
}

export function AddClientModal({ isOpen, onClose, onClientAdded, initialData }: AddClientModalProps) {
  const addToast = useUIStore((s) => s.addToast);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [clientName, setClientName] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('IL');
  const [zip, setZip] = useState('');
  const [acres, setAcres] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [annualRevenue, setAnnualRevenue] = useState('');
  const [snowService, setSnowService] = useState(false);
  const [accessNotes, setAccessNotes] = useState('');

  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const dirty =
    clientName || serviceAddress || city !== 'IL' || zip || acres || annualRevenue || accessNotes;

  const isEditMode = !!initialData;

  // Reset form when modal opens (pre-fill in edit mode)
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setClientName(initialData.client_name || '');
        setServiceAddress(initialData.service_address || '');
        setCity(initialData.city || '');
        setState(initialData.state || 'IL');
        setZip(initialData.zip || '');
        setAcres(initialData.acres != null ? String(initialData.acres) : '');
        setFrequency((initialData.service_frequency as 'weekly' | 'biweekly' | 'monthly') || 'weekly');
        setAnnualRevenue(initialData.annual_revenue != null ? String(initialData.annual_revenue) : '');
        setSnowService(!!initialData.snow_service);
        setAccessNotes('');
      } else {
        setClientName('');
        setServiceAddress('');
        setCity('');
        setState('IL');
        setZip('');
        setAcres('');
        setFrequency('weekly');
        setAnnualRevenue('');
        setSnowService(false);
        setAccessNotes('');
      }
      setError('');
      setLoading(false);
    }
  }, [isOpen, initialData]);

  // Set up Google Places Autocomplete
  useEffect(() => {
    if (!isOpen || !addressInputRef.current || autocompleteRef.current) return;

    const ac = new google.maps.places.Autocomplete(addressInputRef.current, {
      componentRestrictions: { country: 'us' },
      fields: ['address_components', 'formatted_address'],
      types: ['address'],
    });

    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place.address_components) return;

      let streetNumber = '';
      let streetName = '';
      let placeCity = '';
      let placeState = '';
      let placeZip = '';

      for (const comp of place.address_components) {
        const types = comp.types;
        if (types.includes('street_number')) streetNumber = comp.long_name;
        if (types.includes('route')) streetName = comp.long_name;
        if (types.includes('locality')) placeCity = comp.long_name;
        if (types.includes('administrative_area_level_1')) placeState = comp.short_name;
        if (types.includes('postal_code')) placeZip = comp.long_name;
      }

      setServiceAddress(`${streetNumber} ${streetName}`.trim());
      if (placeCity) setCity(placeCity);
      if (placeState) setState(placeState);
      if (placeZip) setZip(placeZip);
    });

    autocompleteRef.current = ac;

    return () => {
      google.maps.event.clearInstanceListeners(ac);
      autocompleteRef.current = null;
    };
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (dirty && !loading) {
      if (!confirm('Discard unsaved changes?')) return;
    }
    onClose();
  }, [dirty, loading, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        client_name: clientName.trim(),
        service_address: serviceAddress.trim(),
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
        acres: parseFloat(acres),
        service_frequency: frequency,
        ...(annualRevenue ? { annual_revenue: parseFloat(annualRevenue) } : {}),
        snow_service: snowService,
        ...(accessNotes.trim() ? { access_notes: accessNotes.trim() } : {}),
      };

      let savedClient: Client;
      if (isEditMode && initialData) {
        savedClient = await updateClient(initialData.id, payload);
        addToast('Client updated', 'success');
      } else {
        savedClient = await createClient(payload);
        if (savedClient.geocode_status === 'failed') {
          addToast('Client saved but geocode failed — fix address in Needs Attention panel', 'warning');
        } else {
          addToast('Client added — pin will appear on the map', 'success');
        }
      }
      onClientAdded(savedClient);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error;
      if (Array.isArray(msg)) {
        setError(msg.map((e: any) => `${e.path?.join('.')}: ${e.message}`).join(', '));
      } else {
        setError(typeof msg === 'string' ? msg : 'Failed to create client.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const inputCls =
    'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cr-blue disabled:bg-gray-50 disabled:text-gray-400';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-cr-text">{isEditMode ? 'Edit Client' : 'Add Client'}</h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Client Name *</label>
            <input
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              disabled={loading}
              className={inputCls}
              placeholder="e.g. Smith Residence"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Service Address *</label>
            <input
              ref={addressInputRef}
              type="text"
              required
              value={serviceAddress}
              onChange={(e) => setServiceAddress(e.target.value)}
              disabled={loading}
              className={inputCls}
              placeholder="Start typing an address..."
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City *</label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={loading}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">State *</label>
              <input
                type="text"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                disabled={loading}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">ZIP *</label>
              <input
                type="text"
                required
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                disabled={loading}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Acres *</label>
              <input
                type="number"
                required
                step="0.1"
                min="0.1"
                value={acres}
                onChange={(e) => setAcres(e.target.value)}
                disabled={loading}
                className={inputCls}
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Service Frequency *</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as 'weekly' | 'biweekly' | 'monthly')}
                disabled={loading}
                className={inputCls}
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Annual Revenue</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-gray-400">$</span>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={annualRevenue}
                  onChange={(e) => setAnnualRevenue(e.target.value)}
                  disabled={loading}
                  className={`${inputCls} pl-7`}
                  placeholder="Optional"
                />
              </div>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={snowService}
                  onChange={(e) => setSnowService(e.target.checked)}
                  disabled={loading}
                  className="rounded border-gray-300 text-cr-navy focus:ring-cr-blue"
                />
                Snow Service
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Access Notes</label>
            <textarea
              value={accessNotes}
              onChange={(e) => setAccessNotes(e.target.value)}
              disabled={loading}
              className={`${inputCls} resize-none`}
              rows={2}
              placeholder="Gate codes, dogs, access instructions..."
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-cr-border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || !clientName.trim() || !serviceAddress.trim() || !city.trim() || !zip.trim() || !acres}
            className="px-4 py-2 text-sm font-medium text-white bg-cr-navy rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isEditMode ? 'Save Changes' : 'Save & Geocode'}
          </button>
        </div>
      </div>
    </div>
  );
}
