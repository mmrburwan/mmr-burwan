import React from 'react';

interface StructuredDataProps {
  type?: 'Organization' | 'GovernmentService' | 'WebApplication';
  data?: Record<string, any>;
}

const StructuredData: React.FC<StructuredDataProps> = ({ 
  type = 'GovernmentService',
  data = {}
}) => {
  const baseData = {
    '@context': 'https://schema.org',
    '@type': type,
    name: 'MMR Burwan',
    description: 'Official digital marriage registration system for Burwan. Apply online, secure, fast, and paperless.',
    url: 'https://mmrburwan.com',
    logo: 'https://mmrburwan.com/logo.png',
    ...data,
  };

  // Organization schema
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'GovernmentOrganization',
    name: 'MMR Burwan',
    description: 'Official digital marriage registration system for Burwan',
    url: 'https://mmrburwan.com',
    logo: 'https://mmrburwan.com/logo.png',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Service',
      availableLanguage: ['English', 'Bengali'],
    },
    areaServed: {
      '@type': 'City',
      name: 'Burwan',
    },
    serviceType: 'Marriage Registration',
  };

  // Government Service schema
  const governmentServiceSchema = {
    '@context': 'https://schema.org',
    '@type': 'GovernmentService',
    name: 'Digital Marriage Registration',
    description: 'Apply for marriage registration online from anywhere, anytime. Secure, fast, and paperless digital marriage registration system.',
    provider: {
      '@type': 'GovernmentOrganization',
      name: 'MMR Burwan',
    },
    areaServed: {
      '@type': 'City',
      name: 'Burwan',
    },
    serviceType: 'Marriage Registration',
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: 'https://mmrburwan.com',
      serviceType: 'Online',
    },
  };

  // Web Application schema
  const webApplicationSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'MMR Burwan',
    description: 'Official digital marriage registration system for Burwan',
    url: 'https://mmrburwan.com',
    applicationCategory: 'GovernmentApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
    },
    featureList: [
      'Online Marriage Registration',
      'Digital Certificate Download',
      'Certificate Verification',
      '24/7 Support',
      'Secure Data Encryption',
    ],
  };

  let schema = baseData;
  if (type === 'Organization') {
    schema = organizationSchema;
  } else if (type === 'GovernmentService') {
    schema = governmentServiceSchema;
  } else if (type === 'WebApplication') {
    schema = webApplicationSchema;
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

export default StructuredData;

