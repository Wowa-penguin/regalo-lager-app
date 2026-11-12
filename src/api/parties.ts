import constants from "@/constants/const";
import { FinishPartyResult, JoinPartyResult, Party } from "@/types/party";
import { getAuthHeaders } from "@/utils/auth";

// ── Types ────────────────────────────────────────────────────────────────────

interface FinishPartyLine {
  line_id: number;
  collected_qty: number;
}

// Surface the server's own error text (e.g. "Party is not active").
const errorFrom = async (res: Response, fallback: string): Promise<Error> => {
  const json = await res.json().catch(() => ({}));
  return new Error(json.error ?? fallback);
};

// ── Parties ───────────────────────────────────────────────────────────────────

export const fetchParties = async (): Promise<Party[]> => {
  const res = await fetch(`${constants.apiUrl}/regalo/parties`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch parties");
  const json = await res.json();
  return json.parties ?? [];
};

export const fetchParty = async (partyId: number): Promise<Party> => {
  const res = await fetch(`${constants.apiUrl}/regalo/parties/${partyId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch party");
  return res.json();
};

export const createParty = async (
  invoiceNumber: number,
  name: string,
): Promise<Party> => {
  const res = await fetch(`${constants.apiUrl}/regalo/parties`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ invoice_number: invoiceNumber, name }),
  });
  if (!res.ok) throw await errorFrom(res, "Failed to create party");
  return res.json();
};

export const joinParty = async (
  partyId: number,
  name: string,
): Promise<JoinPartyResult> => {
  const res = await fetch(`${constants.apiUrl}/regalo/parties/${partyId}/join`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw await errorFrom(res, "Failed to join party");
  return res.json();
};

export const finishParty = async (
  partyId: number,
  payload: { name: string; basket: number | null; lines: FinishPartyLine[] },
): Promise<FinishPartyResult> => {
  const res = await fetch(
    `${constants.apiUrl}/regalo/parties/${partyId}/finish`,
    {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) throw await errorFrom(res, "Failed to finish party");
  return res.json();
};

export const deleteParty = async (
  partyId: number,
  name: string,
): Promise<void> => {
  // Server requires the owner's name to authorise the cancel.
  const res = await fetch(`${constants.apiUrl}/regalo/parties/${partyId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw await errorFrom(res, "Failed to cancel party");
};
