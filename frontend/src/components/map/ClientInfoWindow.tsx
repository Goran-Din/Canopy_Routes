import { useEffect, useRef, useCallback } from 'react';
import { useMap } from './MapCanvas';
import type { Client, RouteWithSummary } from '../../types/map.types';

const STATUS_COLOURS: Record<string, string> = {
  confirmed: '#2E75B6',
  pending: '#F59E0B',
  new: '#2E8B57',
  at_risk: '#D4760A',
  inactive: '#9E9E9E',
};

interface ClientInfoWindowProps {
  client: Client | null;
  routes: RouteWithSummary[];
  userRole: string;
  onClose: () => void;
  onAssignToRoute: (clientId: string, routeId: string) => void;
  onEditClient?: (client: Client) => void;
  onCheckImpact?: (client: Client) => void;
}

export function ClientInfoWindow({ client, routes, userRole, onClose, onAssignToRoute, onEditClient, onCheckImpact }: ClientInfoWindowProps) {
  const map = useMap();
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleAssign = useCallback(
    (e: Event) => {
      const target = e.target as HTMLSelectElement;
      if (client && target.value) {
        onAssignToRoute(client.id, target.value);
        target.value = '';
      }
    },
    [client, onAssignToRoute]
  );

  useEffect(() => {
    if (!map || !client || client.address_lat == null || client.address_lng == null) {
      if (infoRef.current) infoRef.current.close();
      return;
    }

    if (!infoRef.current) {
      infoRef.current = new google.maps.InfoWindow();
    }

    const iw = infoRef.current;

    // Build content element
    const div = document.createElement('div');
    div.style.cssText = 'font-family:sans-serif;min-width:220px;max-width:300px;font-size:13px;line-height:1.5';

    const assignedRoute = client.assigned_route_id
      ? routes.find((r) => r.route.id === client.assigned_route_id)
      : null;
    const routeLabel = assignedRoute
      ? `${assignedRoute.route.route_label} — ${assignedRoute.route.day_of_week}`
      : 'Unassigned';

    const showRevenue = userRole === 'owner' || userRole === 'coordinator';
    const canAssign = userRole === 'owner' || userRole === 'coordinator';
    const statusColour = STATUS_COLOURS[client.client_status] || '#9E9E9E';

    let html = `
      <div style="margin-bottom:6px">
        <strong style="font-size:15px">${esc(client.client_name)}</strong>
      </div>
      <div>${esc(client.service_address)}</div>
      <div>${esc(client.city)}, ${esc(client.state)} ${esc(client.zip)}</div>
      <div style="margin-top:6px">
        <span>Acres: ${client.acres}${!client.acreage_confirmed ? ' &#9733;' : ''}</span>
        &nbsp;|&nbsp;
        <span style="background:#E2E8F0;padding:1px 6px;border-radius:4px;font-size:11px">${client.service_frequency}</span>
      </div>
      <div style="margin-top:4px">
        Status: <span style="background:${statusColour};color:#fff;padding:1px 6px;border-radius:4px;font-size:11px">${client.client_status}</span>
      </div>
      <div style="margin-top:4px">Route: <strong>${esc(routeLabel)}</strong></div>
    `;

    if (showRevenue && client.annual_revenue != null) {
      html += `<div style="margin-top:4px">Revenue: $${Number(client.annual_revenue).toLocaleString()}</div>`;
    }

    if (canAssign) {
      html += `<div style="margin-top:8px"><select id="__cr_assign" style="width:100%;font-size:12px;padding:4px;border:1px solid #E2E8F0;border-radius:4px"><option value="">Assign to Route...</option>`;
      for (const r of routes) {
        html += `<option value="${r.route.id}">${esc(r.route.route_label)} — ${esc(r.route.day_of_week)}</option>`;
      }
      html += `</select></div>`;

      const btnStyle = 'display:inline-block;font-size:11px;padding:4px 10px;border:1px solid #E2E8F0;border-radius:4px;cursor:pointer;background:#F8FAFC;margin-right:6px;margin-top:8px';
      html += `<div style="margin-top:4px">`;
      html += `<button id="__cr_edit" style="${btnStyle}">&#9998; Edit Client</button>`;
      if (client.assigned_route_id) {
        html += `<button id="__cr_impact" style="${btnStyle}">&#128200; Removal Impact</button>`;
      }
      html += `</div>`;
    }

    div.innerHTML = html;
    containerRef.current = div;

    iw.setContent(div);
    iw.setPosition({ lat: Number(client.address_lat), lng: Number(client.address_lng) });
    iw.open(map);

    // Attach event after DOM is ready
    const handleEdit = () => { if (client && onEditClient) onEditClient(client); };
    const handleImpact = () => { if (client && onCheckImpact) onCheckImpact(client); };

    const attachListener = () => {
      const select = div.querySelector('#__cr_assign') as HTMLSelectElement | null;
      if (select) select.addEventListener('change', handleAssign);
      const editBtn = div.querySelector('#__cr_edit') as HTMLButtonElement | null;
      if (editBtn) editBtn.addEventListener('click', handleEdit);
      const impactBtn = div.querySelector('#__cr_impact') as HTMLButtonElement | null;
      if (impactBtn) impactBtn.addEventListener('click', handleImpact);
    };
    google.maps.event.addListenerOnce(iw, 'domready', attachListener);

    const closeListener = google.maps.event.addListener(iw, 'closeclick', onClose);

    return () => {
      google.maps.event.removeListener(closeListener);
      const select = div.querySelector('#__cr_assign') as HTMLSelectElement | null;
      if (select) select.removeEventListener('change', handleAssign);
      const editBtn = div.querySelector('#__cr_edit') as HTMLButtonElement | null;
      if (editBtn) editBtn.removeEventListener('click', handleEdit);
      const impactBtn = div.querySelector('#__cr_impact') as HTMLButtonElement | null;
      if (impactBtn) impactBtn.removeEventListener('click', handleImpact);
    };
  }, [map, client, routes, userRole, onClose, handleAssign, onEditClient, onCheckImpact]);

  return null;
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  const el = document.createElement('span');
  el.textContent = s;
  return el.innerHTML;
}
