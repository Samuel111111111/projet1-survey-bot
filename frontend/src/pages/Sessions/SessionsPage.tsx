import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * SessionsPage is a thin wrapper that redirects to the campaign detail
 * page with the sessions tab selected. The spec allows sessions to be
 * accessed via a dedicated route, but our implementation centralizes
 * campaign management in a single detail view. Using a query
 * parameter keeps deep links consistent and avoids duplicating logic.
 */
const SessionsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useEffect(() => {
    if (id) {
      navigate(`/campaigns/${id}?tab=sessions`, { replace: true });
    }
  }, [id, navigate]);
  return null;
};

export default SessionsPage;