let _token: string | null = null;

export const setAuthToken = (token: string | null) => {
  _token = token;
};

export const getAuthHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
  ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
});

export const getAuthToken = () => {
  return _token;
};
