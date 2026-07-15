export const getSessionId = (): string => {
  let sid = localStorage.getItem('session_id');
  if (!sid) {
    sid = 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('session_id', sid);
  }
  return sid;
};

export const getProjectId = (): string => {
  // Use env variable or default to analysis-01 for this site
  return import.meta.env.VITE_PROJECT_ID || 'analysis-01';
};

export const apiFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(options.headers || {});
  
  // Set custom headers for multi-tenancy and session isolation
  if (!headers.has('X-Session-Id')) {
    headers.set('X-Session-Id', getSessionId());
  }
  if (!headers.has('X-Project-Id')) {
    headers.set('X-Project-Id', getProjectId());
  }

  // If using a relative URL (e.g. '/api/upload'), prepend the API URL
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  
  // If the url already includes the baseUrl or http, don't prepend again
  let finalUrl = url;
  if (url.startsWith('/')) {
      finalUrl = `${baseUrl}${url}`;
  } else if (url.startsWith('http://localhost') && import.meta.env.VITE_API_URL) {
      // Very naive replace just in case we pass the full URL directly
      // But we will refactor all fetch to use '/api/...'
  }

  return fetch(finalUrl, {
    ...options,
    headers,
  });
};

export const generateAiInterpretation = async (analysisType: string, results: any, promptContext?: string, aiModel: string = 'gemini-flash-latest'): Promise<string> => {
  const res = await apiFetch('/api/ai/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      analysis_type: analysisType,
      results,
      prompt_context: promptContext,
      model: aiModel
    })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const detail = errorData.detail;
    const errorMessage = typeof detail === 'string' ? detail : JSON.stringify(detail || errorData);
    throw new Error(errorMessage || 'AI 해석 요청 실패');
  }
  const data = await res.json();
  return data.interpretation;
};
