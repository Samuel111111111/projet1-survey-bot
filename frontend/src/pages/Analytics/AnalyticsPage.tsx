import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * AnalyticsPage redirects to the campaign detail page with the
 * analytics tab selected. We avoid duplicating analytics logic in a
 * separate page and instead leverage the existing tab within
 * CampaignDetail. This also makes deep linking straightforward.
 */
const AnalyticsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useEffect(() => {
    if (id) {
      navigate(`/campaigns/${id}?tab=analytics`, { replace: true });
    }
  }, [id, navigate]);
  return null;
};

export default AnalyticsPage;