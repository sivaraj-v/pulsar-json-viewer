(() => {
  const regions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1']
  const owners = ['Platform', 'Commerce', 'Identity', 'Payments', 'Discovery', 'Data']
  const services = Array.from({ length: 48 }, (_, index) => {
    const id = index + 1
    const name = ['catalog', 'checkout', 'identity', 'payment', 'search', 'recommendation'][index % 6] + `-${String(id).padStart(2, '0')}`
    const status = index % 13 === 0 ? 'degraded' : index % 17 === 0 ? 'maintenance' : 'healthy'
    return {
      id: `svc-${String(id).padStart(4, '0')}`,
      name,
      owner: owners[index % owners.length],
      tier: (index % 4) + 1,
      status,
      runtime: { language: index % 2 ? 'Node.js' : 'Java', version: index % 2 ? '22.12' : '21.0.5', replicas: 4 + (index % 8) },
      slo: { availability: 99.9 + ((index % 8) / 100), latencyP95Ms: 95 + (index % 11) * 17, errorBudgetRemainingPercent: 44 + (index % 53) },
      regions: regions.slice(0, 2 + (index % 3)),
      deployment: { version: `2026.${String((index % 9) + 1).padStart(2, '0')}.${(index % 27) + 1}`, strategy: index % 3 === 0 ? 'canary' : 'rolling', commit: `a${(900000 + index * 193).toString(16)}` },
      dependencies: [ `svc-${String(((index + 7) % 48) + 1).padStart(4, '0')}`, `svc-${String(((index + 19) % 48) + 1).padStart(4, '0')}` ]
    }
  })

  const audit = Array.from({ length: 120 }, (_, index) => ({
    timestamp: new Date(Date.UTC(2026, 8, 6, 5, index % 60, index % 60)).toISOString(),
    actor: `automation-${(index % 8) + 1}`,
    action: ['deploy', 'scale', 'config-change', 'health-check'][index % 4],
    resource: services[index % services.length].id,
    result: index % 29 === 0 ? 'warning' : 'success',
    traceId: `tr_${(100000000 + index * 8191).toString(36)}`
  }))

  window.PULSAR_LARGE_DATA = {
    generatedAt: '2026-09-06T05:30:00.000Z',
    organization: { id: 'org_8F3K2', name: 'Northstar Digital', environment: 'production', compliance: ['SOC2', 'ISO27001'] },
    summary: { services: services.length, healthy: services.filter(item => item.status === 'healthy').length, degraded: services.filter(item => item.status === 'degraded').length, maintenance: services.filter(item => item.status === 'maintenance').length, regions: regions.length },
    regions: regions.map((region, index) => ({ code: region, activeServices: 31 + index * 5, requestRatePerSecond: 14800 + index * 3120, latencyP95Ms: 112 + index * 14, availability: 99.95 + index * 0.01 })),
    services,
    activeIncidents: [ { id: 'INC-4821', severity: 'SEV-2', service: 'payment-05', title: 'Elevated authorization latency', state: 'mitigating', startedAt: '2026-09-06T04:42:18.000Z' }, { id: 'INC-4818', severity: 'SEV-3', service: 'catalog-14', title: 'Cache miss rate above baseline', state: 'monitoring', startedAt: '2026-09-06T02:18:09.000Z' } ],
    audit
  }
})()
