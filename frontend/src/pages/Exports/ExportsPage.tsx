import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * ExportsPage redirects to the campaign detail page with the exports
 * tab selected. The export functionality is implemented as part of
 * the CampaignDetail component. This wrapper exists solely to
 * preserve the explicit route mentioned in the specification.
 */
const ExportsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useEffect(() => {
    if (id) {
      navigate(`/campaigns/${id}?tab=exports`, { replace: true });
    }
  }, [id, navigate]);
  return null;
};

export default ExportsPage;