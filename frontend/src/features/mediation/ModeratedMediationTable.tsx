import React from 'react';

import { Download } from 'lucide-react';

export const ModeratedMediationTable = ({ results, onExport, isExporting }: { results: any, onExport?: () => void, isExporting?: boolean }) => {
    if (!results || !results.results) return null;
    const res = results.results[0];
    if (!res || !res.m_model || !res.y_model) return null;

    const m = res.m_model;
    const y = res.y_model;
    const cond = res.conditional_effects;
    const indexMed = res.index_of_moderated_mediation;

    return (
        <div className="glass-panel" style={{ borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-base)', paddingBottom: '16px' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontWeight: 'normal', fontSize: '15px' }}>
                    {`<표> 독립변수와 ${res.dv_name}의 관계에서 ${res.mod_name}의 조절된 매개효과`}
                </h3>
                {onExport && (
                    <button onClick={onExport} disabled={isExporting} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 10px', height: 'auto' }}>
                        <Download size={14} /> {isExporting ? '다운로드 중...' : '분석 표 다운로드'}
                    </button>
                )}
            </div>
            <div style={{ padding: '16px', overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', borderTop: '2px solid var(--text-primary)', borderBottom: '2px solid var(--text-primary)', textAlign: 'center', color: 'var(--text-primary)', fontSize: '13px' }}>
                    <thead>
                        <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
                            <th rowSpan={2} colSpan={2} style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>구분</th>
                            <th colSpan={3} style={{ padding: '10px', borderRight: '1px solid var(--border-color)' }}>매개변수모형 ({res.med_name})</th>
                            <th colSpan={3} style={{ padding: '10px' }}>종속변수모형 ({res.dv_name})</th>
                        </tr>
                        <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--text-primary)' }}>
                            <th style={{ padding: '6px', fontWeight: 'normal' }}>Coeffe(B)</th>
                            <th style={{ padding: '6px', fontWeight: 'normal' }}>SE</th>
                            <th style={{ padding: '6px', fontWeight: 'normal', borderRight: '1px solid var(--border-color)' }}>t값</th>
                            <th style={{ padding: '6px', fontWeight: 'normal' }}>Coeffe(B)</th>
                            <th style={{ padding: '6px', fontWeight: 'normal' }}>SE</th>
                            <th style={{ padding: '6px', fontWeight: 'normal' }}>t값</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from(new Set([...m.coefficients.map((c:any)=>c.name), ...y.coefficients.map((c:any)=>c.name)])).map((name: any, idx: number, arr: any[]) => {
                            const cM = m.coefficients.find((x: any) => x.name === name) || { B: null, SE: null, t: null };
                            const cY = y.coefficients.find((x: any) => x.name === name) || { B: null, SE: null, t: null };
                            return (
                                <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    {idx === 0 && <td rowSpan={arr.length} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>-</td>}
                                    <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{name}</td>
                                    
                                    <td style={{ padding: '8px' }}>{cM.B !== null ? cM.B.toFixed(3) : ''}</td>
                                    <td style={{ padding: '8px' }}>{cM.SE !== null ? cM.SE.toFixed(3) : ''}</td>
                                    <td style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{cM.t !== null ? cM.t.toFixed(3) : ''}</td>
                                    
                                    <td style={{ padding: '8px' }}>{cY.B !== null ? cY.B.toFixed(3) : ''}</td>
                                    <td style={{ padding: '8px' }}>{cY.SE !== null ? cY.SE.toFixed(3) : ''}</td>
                                    <td style={{ padding: '8px' }}>{cY.t !== null ? cY.t.toFixed(3) : ''}</td>
                                </tr>
                            );
                        })}
                        <tr style={{ borderBottom: '1px solid var(--border-color)', borderTop: '1px solid var(--text-primary)' }}>
                            <td colSpan={2} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>R²</td>
                            <td colSpan={3} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{m.r_squared.toFixed(3)}</td>
                            <td colSpan={3} style={{ padding: '8px' }}>{y.r_squared.toFixed(3)}</td>
                        </tr>
                        <tr style={{ borderBottom: '2px solid var(--text-primary)' }}>
                            <td colSpan={2} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>F</td>
                            <td colSpan={3} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{m.f_value.toFixed(3)}</td>
                            <td colSpan={3} style={{ padding: '8px' }}>{y.f_value.toFixed(3)}</td>
                        </tr>
                        
                        {/* Conditional Effects */}
                        <tr style={{ backgroundColor: 'var(--bg-surface)' }}>
                            <td colSpan={8} style={{ padding: '10px', fontWeight: 'bold' }}>{res.mod_name}에 따른 {res.med_name}의 조건부 효과</td>
                        </tr>
                        <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--text-primary)', borderTop: '1px solid var(--text-primary)' }}>
                            <td colSpan={2} style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}>{res.mod_name}</td>
                            <td colSpan={2} style={{ padding: '6px' }}>Effect(B)</td>
                            <td style={{ padding: '6px' }}>se</td>
                            <td style={{ padding: '6px' }}>t값</td>
                            <td style={{ padding: '6px' }}>LLCI</td>
                            <td style={{ padding: '6px' }}>ULCI</td>
                        </tr>
                        {cond.map((c: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td colSpan={2} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{c.w_value.toFixed(3)} ({c.w_label})</td>
                                <td colSpan={2} style={{ padding: '8px' }}>{c.effect.toFixed(3)}</td>
                                <td style={{ padding: '8px' }}>{c.se.toFixed(3)}</td>
                                <td style={{ padding: '8px' }}>{c.t.toFixed(3)}</td>
                                <td style={{ padding: '8px' }}>{c.llci.toFixed(3)}</td>
                                <td style={{ padding: '8px' }}>{c.ulci.toFixed(3)}</td>
                            </tr>
                        ))}
                        
                        {/* Index of Moderated Mediation */}
                        <tr style={{ backgroundColor: 'var(--bg-surface)', borderTop: '2px solid var(--text-primary)' }}>
                            <td colSpan={8} style={{ padding: '10px', fontWeight: 'bold' }}>조절된 매개효과 지수 (Index of Moderated Mediation)</td>
                        </tr>
                        <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--text-primary)', borderTop: '1px solid var(--text-primary)' }}>
                            <td colSpan={4} style={{ padding: '6px', borderRight: '1px solid var(--border-color)' }}>Index</td>
                            <td style={{ padding: '6px' }}>se</td>
                            <td colSpan={3} style={{ padding: '6px' }}>95% CI [LLCI, ULCI]</td>
                        </tr>
                        <tr>
                            <td colSpan={4} style={{ padding: '8px', borderRight: '1px solid var(--border-color)' }}>{indexMed.index.toFixed(3)}</td>
                            <td style={{ padding: '8px' }}>{indexMed.se.toFixed(3)}</td>
                            <td colSpan={3} style={{ padding: '8px' }}>[{indexMed.llci.toFixed(3)}, {indexMed.ulci.toFixed(3)}]</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
};
