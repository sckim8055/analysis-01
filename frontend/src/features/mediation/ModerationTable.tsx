import React from 'react';

export const ModerationTable = ({ results }: { results: any }) => {
    if (!results || !results.results) return null;
    const res = results.results[0]; // Assuming one DV for now
    if (!res || !res.model1) return null;

    const m1 = res.model1;
    const m2 = res.model2;
    const m3 = res.model3;

    return (
        <div className="glass-panel" style={{ borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', paddingBottom: '16px' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)' }}>
                <h3 style={{ margin: 0, fontWeight: 'normal', fontSize: '15px' }}>
                    {`<표> 독립변수와 ${res.dv_name} 간의 ${res.mod_name}의 조절효과`}
                </h3>
            </div>
            <div style={{ padding: '16px', overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', borderTop: '2px solid var(--text-primary)', borderBottom: '2px solid var(--text-primary)', textAlign: 'center', color: 'var(--text-primary)', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                            <th rowSpan={2} style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>구분</th>
                            <th colSpan={3} style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>모델 I</th>
                            <th colSpan={3} style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>모델 II</th>
                            <th colSpan={3} style={{ padding: '10px' }}>모델 III</th>
                        </tr>
                        <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--text-primary)' }}>
                            <th style={{ padding: '6px', fontWeight: 'normal' }}>β</th>
                            <th style={{ padding: '6px', fontWeight: 'normal' }}>t</th>
                            <th style={{ padding: '6px', fontWeight: 'normal', borderRight: '1px solid var(--border-color)' }}>p</th>
                            <th style={{ padding: '6px', fontWeight: 'normal' }}>β</th>
                            <th style={{ padding: '6px', fontWeight: 'normal' }}>t</th>
                            <th style={{ padding: '6px', fontWeight: 'normal', borderRight: '1px solid var(--border-color)' }}>p</th>
                            <th style={{ padding: '6px', fontWeight: 'normal' }}>β</th>
                            <th style={{ padding: '6px', fontWeight: 'normal' }}>t</th>
                            <th style={{ padding: '6px', fontWeight: 'normal' }}>p</th>
                        </tr>
                    </thead>
                    <tbody>
                        {m3.coefficients.map((c: any, idx: number) => {
                            if (c.name === 'const') return null; // Skip constant if desired
                            const c1 = m1.coefficients.find((x: any) => x.name === c.name) || { B: null, t: null, p: null };
                            const c2 = m2.coefficients.find((x: any) => x.name === c.name) || { B: null, t: null, p: null };
                            return (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{c.name}</td>
                                    <td style={{ padding: '8px' }}>{c1.B !== null ? c1.B.toFixed(3) : ''}</td>
                                    <td style={{ padding: '8px' }}>{c1.t !== null ? c1.t.toFixed(3) : ''}</td>
                                    <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{c1.p !== null ? (c1.p < 0.001 ? '.000' : c1.p.toFixed(3)) : ''}</td>
                                    
                                    <td style={{ padding: '8px' }}>{c2.B !== null ? c2.B.toFixed(3) : ''}</td>
                                    <td style={{ padding: '8px' }}>{c2.t !== null ? c2.t.toFixed(3) : ''}</td>
                                    <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{c2.p !== null ? (c2.p < 0.001 ? '.000' : c2.p.toFixed(3)) : ''}</td>
                                    
                                    <td style={{ padding: '8px' }}>{c.B !== null ? c.B.toFixed(3) : ''}</td>
                                    <td style={{ padding: '8px' }}>{c.t !== null ? c.t.toFixed(3) : ''}</td>
                                    <td style={{ padding: '8px' }}>{c.p !== null ? (c.p < 0.001 ? '.000' : c.p.toFixed(3)) : ''}</td>
                                </tr>
                            );
                        })}
                        <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)', borderTop: '2px solid var(--text-primary)' }}>
                            <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>F-value</td>
                            <td colSpan={3} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{m1.f_value.toFixed(3)}</td>
                            <td colSpan={3} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{m2.f_value.toFixed(3)}</td>
                            <td colSpan={3} style={{ padding: '8px' }}>{m3.f_value.toFixed(3)}</td>
                        </tr>
                        <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>유의확률 F변화량</td>
                            <td colSpan={3} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{m1.f_p_value < 0.001 ? '.000' : m1.f_p_value.toFixed(3)}</td>
                            <td colSpan={3} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{m2.f_p_value < 0.001 ? '.000' : m2.f_p_value.toFixed(3)}</td>
                            <td colSpan={3} style={{ padding: '8px' }}>{m3.f_p_value < 0.001 ? '.000' : m3.f_p_value.toFixed(3)}</td>
                        </tr>
                        <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>R²</td>
                            <td colSpan={3} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{m1.r_squared.toFixed(3)}</td>
                            <td colSpan={3} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{m2.r_squared.toFixed(3)}</td>
                            <td colSpan={3} style={{ padding: '8px' }}>{m3.r_squared.toFixed(3)}</td>
                        </tr>
                        <tr style={{ backgroundColor: 'var(--bg-surface)' }}>
                            <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>Change of R²</td>
                            <td colSpan={3} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>-</td>
                            <td colSpan={3} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{m2.delta_r_squared.toFixed(3)}</td>
                            <td colSpan={3} style={{ padding: '8px' }}>{m3.delta_r_squared.toFixed(3)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};
