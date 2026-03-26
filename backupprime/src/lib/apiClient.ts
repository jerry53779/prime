const API_BASE_URL = (import.meta.env.VITE_API_URL as string) || 'https://prime-6hzf.onrender.com/api';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

const handleResponse = async (response: Response) => {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    return {
      error: (data as any)?.error || (data as any)?.message || 'API request failed',
    };
  }

  return data;
};

const request = async (path: string, options: RequestInit = {}) => {
  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt += 1;
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          ...jsonHeaders,
          ...(options.headers || {}),
        },
      });

      return await handleResponse(response);
    } catch (error: any) {
      const message = (error && error.message) || 'Network error';
      console.warn(`apiClient request retry ${attempt}/${maxRetries} for ${path}:`, message);

      const isTransient =
        message.includes('10035') ||
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('Failed to fetch');

      if (attempt >= maxRetries || !isTransient) {
        return {error: message};
      }

      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
  }

  return {error: 'Network error after retries'};
};

export const apiClient = {
  login: (username: string, password: string, role: string) =>
    request('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({username, password, role}),
    }),

  register: (username: string, password: string, name: string, role: string) =>
    request('/auth/register/', {
      method: 'POST',
      body: JSON.stringify({username, password, name, role}),
    }),

  getAllUsers: () => request('/users/'),
  getUser: (userId: string) => request(`/users/${userId}/`),
  updateUser: (userId: string, payload: unknown) =>
    request(`/users/${userId}/update/`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteUser: (userId: string) =>
    request(`/users/${userId}/delete/`, {method: 'DELETE'}),

  getProjects: () => request('/projects/'),
  getProject: (projectId: string) => request(`/projects/${projectId}/`),
  createProject: (project: unknown) =>
    request('/projects/create/', {
      method: 'POST',
      body: JSON.stringify(project),
    }),
  updateProject: (projectId: string, payload: unknown) =>
    request(`/projects/${projectId}/update/`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteProject: (projectId: string) =>
    request(`/projects/${projectId}/delete/`, {method: 'DELETE'}),
  getCommitHistory: (projectId: string) =>
    request(`/projects/${projectId}/commits/`),

  getAccessRequests: () => request('/access-requests/'),
  getAccessRequestsForProject: (projectId: string) =>
    request(`/access-requests/project/${projectId}/`),
  createAccessRequest: (projectId: string, facultyId: string, facultyName: string) =>
    request('/access-requests/create/', {
      method: 'POST',
      body: JSON.stringify({projectId, facultyId, facultyName}),
    }),
  approveAccessRequest: (requestId: string) =>
    request(`/access-requests/${requestId}/approve/`, {method: 'PUT'}),
  rejectAccessRequest: (requestId: string) =>
    request(`/access-requests/${requestId}/reject/`, {method: 'PUT'}),

  getLandingContent: () => request('/landing-content/'),
  updateLandingContent: (payload: unknown) =>
    request('/landing-content/update/', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
};
