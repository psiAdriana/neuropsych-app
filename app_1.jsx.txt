
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ══════════════════════════════════════════════════════════════════════════════
// ─── INTERPRETACIONES CLÍNICAS AUTOMÁTICAS ───────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function getClinicalInterp(testId, results, patient, norms) {
  const name = patient.name ? patient.name.split(" ")[0] : "El/la paciente";
  const z = (v, m, sd) => sd > 0 ? ((v - m) / sd).toFixed(2) : null;
  const band = (zv) => {
    const zf = parseFloat(zv);
    if (isNaN(zf)) return null;
    if (zf >= 1.5) return "superior";
    if (zf >= -0.99) return "normal";
    if (zf >= -1.32) return "límite inferior normativo";
    if (zf >= -1.99) return "dificultad leve";
    if (zf >= -2.49) return "dificultad moderada";
    return "dificultad elevada";
  };

  switch(testId) {
    case "tmt": {
      if (!results.tmt) return null;
      const t = results.tmt;
      const lines = [];
      if (t.timeA !== undefined && t.timeA !== "") {
        const b = band(t.zA);
        const pc = t.pctA || "";
        if (b === "superior" || b === "normal") {
          lines.push(`TMT-A: La velocidad de rastreo visomotor y la atención focalizada (${t.timeA} seg${pc?", Pc"+pc:""}) se encuentran dentro de los parámetros esperados para el grupo normativo. No se observan indicadores de compromiso en la velocidad de procesamiento.`);
        } else {
          lines.push(`TMT-A: Se objetiva ${b} en la velocidad de rastreo visomotor (${t.timeA} seg${pc?", Pc"+pc:""}), sugiriendo dificultades en la atención sostenida y la velocidad de procesamiento. Desde el modelo de Tirapu-Ustárroz, el TMT-A es sensible a la sustancia blanca y el circuito frontoparietal.`);
        }
      }
      if (t.timeB !== undefined && t.timeB !== "") {
        const b = band(t.zB);
        const pc = t.pctB || "";
        if (b === "superior" || b === "normal") {
          lines.push(`TMT-B: La atención alternante y la flexibilidad cognitiva (${t.timeB} seg${pc?", Pc"+pc:""}) se encuentran conservadas. La persona puede alternar eficientemente entre dos criterios de respuesta simultáneos.`);
        } else {
          lines.push(`TMT-B: Se observa ${b} en la ejecución (${t.timeB} seg${pc?", Pc"+pc:""}), indicando compromisos en la flexibilidad cognitiva y la atención alternante. Esta prueba es especialmente sensible a la alternancia cognitiva mediada por el córtex prefrontal dorsolateral.`);
        }
        if (t.zBminusA !== undefined) {
          const b2 = band(t.zBminusA);
          if (b2 !== "superior" && b2 !== "normal") {
            lines.push(`El índice diferencial B−A (${t.zBminusA > 0 ? "+" : ""}${t.zBminusA}) indica dificultad específica en el componente ejecutivo de la alternancia, más allá de la velocidad de procesamiento basal, lo que señala compromiso selectivo en funciones de control del SAS.`);
          } else {
            lines.push(`El índice diferencial B−A es consistente con el rendimiento global, sin evidencia de compromiso ejecutivo específico en la alternancia.`);
          }
        }
      }
      return lines.length ? lines.join(" ") : null;
    }
    case "stroop": {
      if (!results.stroop) return null;
      const s = results.stroop;
      const parts = [];
      if (s.tP) parts.push(`velocidad lectora (T=${s.tP}): ${band(parseFloat(s.zP||0))}`);
      if (s.tC) parts.push(`denominación de colores (T=${s.tC}): ${band(parseFloat(s.zC||0))}`);
      if (s.tPC) parts.push(`condición interferencia (T=${s.tPC}): ${band(parseFloat(s.zPC||0))}`);
      if (!parts.length) return null;
      const zInterf = parseFloat(s.zInterf||0);
      let interfText = "";
      if (s.tInterf !== undefined) {
        if (zInterf < -1.5) interfText = ` El índice de interferencia (T=${s.tInterf}) señala dificultades marcadas en el control inhibitorio: la persona presenta dificultad para suprimir respuestas automáticas (leer la palabra) en favor de la respuesta no habitual (nombrar el color). Desde el modelo de Tirapu-Ustárroz, esto refleja compromiso en la capacidad de inhibición del SAS (Sistema Atencional Supervisor).`;
        else if (zInterf < -1) interfText = ` La interferencia (T=${s.tInterf}) muestra compromisos leves en el control inhibitorio y la resistencia a la interferencia.`;
        else interfText = ` La resistencia a la interferencia (T=${s.tInterf}) se encuentra preservada, indicando adecuada capacidad de inhibición de respuestas automáticas.`;
      }
      return `Stroop (Galaverna 2014, ARG): ${parts.join("; ")}.${interfText} Este test evalúa la inhibición como proceso ejecutivo central, vinculado funcionalmente al córtex prefrontal dorsolateral y al cíngulo anterior (Tirapu-Ustárroz & Luna-Lario).`;
    }
    case "fv": {
      if (!results.fv) return null;
      const fv = results.fv;
      const lines = [];
      if (fv.semantic !== undefined) {
        const b = band(fv.zSem);
        if (b === "normal" || b === "superior") lines.push(`La fluidez verbal semántica (${fv.semantic} palabras) se encuentra dentro de los parámetros esperados, sin evidencia de compromiso en el acceso léxico mediado por categorías semánticas.`);
        else lines.push(`La fluidez verbal semántica (${fv.semantic} palabras) presenta ${b}, sugiriendo posibles dificultades en el acceso léxico semántico y/o en funciones de iniciación y mantenimiento verbal.`);
      }
      if (fv.phonologic !== undefined) {
        const b = band(fv.zFon);
        if (b === "normal" || b === "superior") lines.push(`La fluidez fonológica (${fv.phonologic} palabras) se encuentra preservada, indicando adecuado funcionamiento frontoestriatal.`);
        else lines.push(`La fluidez fonológica (${fv.phonologic} palabras) muestra ${b}, lo que puede reflejar dificultades en estrategias de búsqueda léxica y funciones frontales.`);
      }
      return lines.join(" ") || null;
    }
    case "moca": {
      if (!results.moca) return null;
      const m = results.moca;
      if (m.total >= 26) return `El MoCA (${m.total}/30) se encuentra dentro del rango normal (corte ≥26), sin indicadores de deterioro cognitivo leve en el cribado multidominio.`;
      return `El MoCA (${m.total}/30, ajustado: ${m.adjusted}) se encuentra por debajo del punto de corte (≥26), sugiriendo posibles dificultades cognitivas que ameritan evaluación más exhaustiva por dominios.`;
    }
    case "ravlt": {
      if (!results.ravlt?.scores) return null;
      const rv = results.ravlt;
      const a1 = parseInt(rv.scores.A1)||0, a5 = parseInt(rv.scores.A5)||0;
      const a7 = rv.scores.A7 !== undefined ? parseInt(rv.scores.A7) : null;
      const curva = a5 > a1 ? "progresiva" : a5 === a1 ? "plana" : "descendente";
      let txt = `RAVLT: Ensayo inicial A1=${a1}, ensayo final A5=${a5} (curva de aprendizaje ${curva}).`;
      if (a7 !== null) {
        const retPct = a5 > 0 ? Math.round(a7/a5*100) : 0;
        txt += ` Retención diferida A7=${a7} (${retPct}% de lo aprendido en A5).`;
        if (retPct < 80) txt += " La pérdida de información diferida sugiere dificultades en la consolidación de material verbal.";
        else txt += " La retención diferida se encuentra adecuada.";
      }
      return txt;
    }
    case "tavec": {
      if (!results.tavec?.scores) return null;
      const tv = results.tavec;
      const sc = tv.scores;
      const parts = [];
      if (sc.A5 !== undefined) {
        const n = TAVEC_NORMS?.[tv.ag]?.A5;
        const zv = n ? parseFloat(((parseFloat(sc.A5)-n.m)/n.s).toFixed(2)) : null;
        parts.push(`aprendizaje total A5=${sc.A5} (${band(zv)})`);
      }
      if (sc.rlld !== undefined) {
        const n = TAVEC_NORMS?.[tv.ag]?.rlld;
        const zv = n ? parseFloat(((parseFloat(sc.rlld)-n.m)/n.s).toFixed(2)) : null;
        parts.push(`recuerdo libre largo plazo=${sc.rlld} (${band(zv)})`);
      }
      if (sc.recog !== undefined) parts.push(`reconocimiento=${sc.recog}/16`);
      return parts.length ? `TAVEC: ${parts.join("; ")}. Los índices de recuerdo con claves y reconocimiento permiten distinguir entre déficit de recuperación y de consolidación.` : null;
    }
    case "wcst": {
      if (!results.wcst) return null;
      const w = results.wcst;
      const sc = w.scores;
      const parts = [];
      if (sc.categories !== undefined) parts.push(`categorías completadas: ${sc.categories}/6`);
      if (sc.persevErrors !== undefined) parts.push(`errores perseverativos: ${sc.persevErrors}`);
      if (!parts.length) return null;
      const persev = sc.persevErrors !== undefined && parseInt(sc.persevErrors) > 15;
      const cats = sc.categories !== undefined ? parseInt(sc.categories) : null;
      let interp = "";
      if (persev) {
        interp = " El elevado número de errores perseverativos indica rigidez cognitiva y dificultades en el cambio de criterio (set-shifting). Desde el modelo de Miyake et al., la alternancia cognitiva es uno de los tres factores centrales de las FE y se asocia al funcionamiento del córtex prefrontal dorsolateral. La perseveración señala que la persona continúa aplicando una regla de clasificación previa pese al feedback negativo, lo que puede reflejar una disfunción del SAS de Norman & Shallice.";
      } else if (cats !== null && cats < 4) {
        interp = " El número reducido de categorías completadas sugiere dificultades en la flexibilidad cognitiva y la capacidad de abstraer y cambiar criterios de clasificación. No obstante, la perseveración no es el mecanismo principal.";
      } else {
        interp = " No se observa perseveración significativa. La alternancia cognitiva se encuentra dentro de los parámetros esperados.";
      }
      return `WCST Abreviado 64 cartas (Axelrod et al., 1993): ${parts.join(", ")}.${interp}`;
    }
    case "bads": {
      if (!results.bads) return null;
      const b = results.bads;
      const bStr = band(b.z);
      if (bStr === "normal" || bStr === "superior") return `BADS (Farías Sarquís, 2021, ARG): El perfil de funcionamiento ejecutivo ecológico (${b.total}/24, Z=${b.z}) se encuentra dentro de los parámetros normativos. No se observan indicadores de síndrome disejecutivo en tareas que replican demandas de la vida cotidiana. La BADS es especialmente sensible a la validez ecológica del funcionamiento ejecutivo, evaluando componentes de planificación, memoria prospectiva y multitasking en contextos similares a situaciones reales.`;
      return `BADS (Farías Sarquís, 2021, ARG): El perfil ejecutivo ecológico (${b.total}/24, Z=${b.z}) presenta ${bStr}, sugiriendo dificultades en la planificación, generación de estrategias y resolución de problemas en contextos de la vida real. Este patrón es consistente con el concepto de síndrome disejecutivo descrito por Tirapu-Ustárroz, donde las principales dificultades no radican en tareas de laboratorio con estructura externa explícita, sino en la iniciación, organización y supervisión autónoma de secuencias de conducta orientadas a objetivos (Structured Event Complexes, según Grafman).`;
    }
    case "ifs": {
      if (!results.ifs) return null;
      return results.ifs.below
        ? `IFS: La puntuación total (${results.ifs.total.toFixed(1)}/30) se encuentra por debajo del punto de corte clínico (25), compatible con disfunción ejecutiva frontal. El índice de memoria de trabajo (${results.ifs.wm}/10) contribuye al perfil de compromiso frontal.`
        : `IFS: La puntuación total (${results.ifs.total.toFixed(1)}/30) supera el punto de corte (25), sin indicadores de disfunción ejecutiva en el cribado frontal.`;
    }
    case "d2": {
      if (!results.d2) return null;
      const d = results.d2;
      const parts = [];
      if (d.TA !== null) {
        const b = band(d.zTA);
        parts.push(`total de aciertos (TA=${d.TA}, Z=${d.zTA}): ${b}`);
      }
      if (d.CON !== null) {
        const b = band(d.zCON);
        parts.push(`concentración (CON=${d.CON}, Z=${d.zCON}): ${b}`);
      }
      if (!parts.length) return null;
      return `d2: ${parts.join("; ")}. La relación entre velocidad (TR) y precisión (CON) permite estimar la calidad atencional. ${d.Epct !== null ? `Porcentaje de error: ${d.Epct}%.` : ""}`;
    }
    case "wais": {
      if (!results.wais) return null;
      const cit = results.wais.cit;
      if (!cit) return null;
      const v = parseInt(cit);
      const cls = classifyWAIS(v);
      return `WAIS-IV: Cociente Intelectual Total = ${v} — ${cls.label} (Pc${waisPct(v)}). ${v < 90 ? "Se sugiere considerar el perfil por índices para identificar fortalezas y debilidades específicas." : "El rendimiento cognitivo global se ubica dentro del rango esperado."}`;
    }
    case "scl90": {
      if (!results.scl90) return null;
      const sigs = Object.entries(SCL90_DIMS).filter(([dk]) => {
        const ds = results.scl90.dims[dk];
        return ds && ds.t >= 63;
      }).map(([dk, dd]) => dd.label);
      if (sigs.length === 0) return `SCL-90-R: El índice global de severidad (IGS T=${results.scl90.igsT}) no supera el umbral clínico (T=63). No se observan dimensiones sintomáticas clínicamente significativas.`;
      return `SCL-90-R: Se identifican dimensiones con significación clínica (T≥63): ${sigs.join(", ")}. El IGS (T=${results.scl90.igsT}) indica ${results.scl90.igsCls?.label||"—"}. Estos hallazgos deben contextualizarse con la entrevista clínica.`;
    }
    case "mbi": {
      if (!results.mbi) return null;
      const m = results.mbi;
      if (m.burnout) return `MBI: Perfil compatible con burnout. Agotamiento emocional ${m.clsAE?.level||""}, despersonalización ${m.clsD?.level||""}, realización personal ${m.clsRP?.level||""}. Se recomienda intervención especializada en manejo del estrés laboral.`;
      return `MBI: No se observa perfil de burnout completo. Agotamiento emocional: ${m.clsAE?.level||"—"}; despersonalización: ${m.clsD?.level||"—"}; realización personal: ${m.clsRP?.level||"—"}.`;
    }
    case "wurs": {
      if (!results.wurs) return null;
      const w = results.wurs;
      return `WURS-25 (Scandar, 2021, ARG): Puntaje retrospectivo de TDAH en la infancia ${w.score25}/100 (Z=${w.z25}, Pc${w.pct25}). ${w.cutScandar ? "Supera el punto de corte de Scandar (≥36.5, especificidad 90%), sugestivo de sintomatología compatible con TDAH en la infancia. Esta escala evalúa la historia evolutiva del trastorno, criterio indispensable para el diagnóstico en adultos (inicio previo a los 12 años según DSM-5). Los resultados deben integrarse con el ASRS (sintomatología actual), la evaluación neuropsicológica formal y la historia clínica." : "No supera el punto de corte para TDAH infantil retrospectivo (Scandar, ARG ≥36.5). Un resultado negativo no descarta el trastorno en presencia de sintomatología actual significativa, dado que muchos adultos con TDAH desarrollan estrategias compensatorias que atenúan el recuerdo retrospectivo de los síntomas."} ${w.cutWard ? "También supera el corte de Ward et al. (1993, ≥46), reforzando la sospecha diagnóstica." : ""}`;
    }
    case "asrs": {
      if (!results.asrs) return null;
      const a = results.asrs;
      const sospecha = a.pctT >= 75;
      const perfilI = a.pctI >= 75 && a.pctH < 75 ? "predominantemente inatento" : a.pctH >= 75 && a.pctI < 75 ? "predominantemente hiperactivo-impulsivo" : a.pctI >= 75 && a.pctH >= 75 ? "combinado" : "sin perfil clínicamente significativo";
      return `ASRS v1.1 (Scandar, 2021, ARG): Total=${a.scoreT}/72 (Pc${a.pctT}), Inatención=${a.scoreI}/36 (Pc${a.pctI}), Hiperactividad/Impulsividad=${a.scoreH}/36 (Pc${a.pctH}). ${sospecha ? `El puntaje obtenido eleva la sospecha clínica de TDAH actual, con un perfil ${perfilI}. Consistente con la literatura (Robles Bermejo, Anales de Pediatría, 2023), el perfil de TDAH suele mostrar puntuaciones dentro de la normalidad pero significativamente elevadas respecto a la población general, especialmente en inatención y velocidad de procesamiento.` : "Los puntajes no alcanzan umbrales de sospecha clínica para TDAH en la actualidad. Estos resultados deben integrarse con la historia evolutiva (WURS), la evaluación neuropsicológica formal y los cuestionarios conductuales (BRIEF-A)."} Recordar que los varones tienden a presentar más síntomas externalizantes, con riesgo de infradiagnóstico en mujeres (Robles Bermejo, 2023).`;
    }
    case "snap": {
      if (!results.snap) return null;
      const s = results.snap;
      return `SNAP-IV: DA=${s.sumDA} (M=${s.meanDA}, ${s.daPos?"supera":"no supera"} el corte ≥1.66), HI=${s.sumHI} (M=${s.meanHI}, ${s.hiPos?"supera":"no supera"} el corte ≥1.77). Perfil: ${s.subtype}.`;
    }
    case "briefa": {
      if (!results.briefa) return null;
      const br = results.briefa;
      const {BRI, MI, GEC} = br;
      const bri_sig = BRI && BRI.t >= 65;
      const mi_sig = MI && MI.t >= 65;
      const gec_sig = GEC && GEC.t >= 65;
      const bri_bord = BRI && BRI.t >= 60 && BRI.t < 65;
      const mi_bord = MI && MI.t >= 60 && MI.t < 65;
      if (!BRI && !MI && !GEC) return null;
      let texto = `BRIEF-A (Roth et al., 2005): `;
      if (gec_sig) {
        texto += `El Índice Global Ejecutivo (GEC T=${GEC.t}) supera el umbral clínico (T≥65), indicando alteraciones clínicamente significativas en el funcionamiento ejecutivo cotidiano. `;
      } else if (GEC && GEC.t >= 60) {
        texto += `El Índice Global Ejecutivo (GEC T=${GEC.t}) se encuentra en rango borderline, señalando dificultades en el borde del umbral clínico. `;
      } else if (GEC) {
        texto += `El Índice Global Ejecutivo (GEC T=${GEC.t}) se encuentra dentro del rango normativo. `;
      }
      if (BRI && MI) {
        texto += `A nivel de índices compuestos: BRI (Regulación Conductual) T=${BRI.t} — ${BRI.label}; MI (Metacognición) T=${MI.t} — ${MI.label}. `;
        if (mi_sig && !bri_sig) {
          texto += `El patrón de elevación predominante en el índice de Metacognición (con BRI conservado) sugiere que las principales dificultades ejecutivas radican en la capacidad de iniciar, planificar, organizar y supervisar autónomamente las actividades, más que en los procesos de regulación emocional e inhibición. Este patrón es especialmente frecuente en el TDAH de presentación inatenta (Robles Bermejo, Anales de Pediatría, 2023). `;
        } else if (bri_sig && mi_sig) {
          texto += `La elevación conjunta de ambos índices (BRI y MI) indica compromisos tanto en la regulación conductual (inhibición, flexibilidad, control emocional) como en los procesos metacognitivos (iniciativa, memoria de trabajo, planificación, monitoreo). `;
        } else if (bri_sig && !mi_sig) {
          texto += `La elevación del BRI con MI conservado sugiere dificultades predominantes en la autorregulación conductual y emocional, más que en los procesos de planificación y organización. `;
        }
      }
      texto += `Es fundamental destacar la posible discrepancia entre el rendimiento en pruebas formales (donde la estructura externa de las consignas puede sostener el desempeño) y las dificultades reportadas en vida cotidiana. Esta disociación es un hallazgo diagnósticamente relevante, consistente con la menor validez ecológica de los tests estructurados (Tirapu-Ustárroz & Luna-Lario; Robles Bermejo, 2023).`;
      return texto;
    }
    default: return null;
  }
}

function ClinicalInterpBlock({testId, results, patient, source}){
  const text = getClinicalInterp(testId, results, patient, {});
  if (!text) return null;
  return(
    <div style={{marginTop:16,background:"#f8fffe",border:`1px solid ${C.accent}30`,borderRadius:10,padding:"14px 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <span style={{fontSize:16}}>📋</span>
        <span style={{fontFamily:font,fontSize:13,fontWeight:700,color:C.primary}}>Interpretación clínica</span>
      </div>
      <div style={{fontFamily:font,fontSize:12,color:C.textDark,lineHeight:1.7}}>{text}</div>
      {source&&<div style={{fontFamily:font,fontSize:10,color:C.textLight,marginTop:10,fontStyle:"italic"}}>{source}</div>}
    </div>
  );
}

function ClearBtn({onClear,label="Limpiar datos"}){
  return(
    <button onClick={()=>{if(window.confirm("¿Limpiar los datos de esta prueba?"))onClear();}}
      style={{padding:"5px 12px",borderRadius:6,background:"transparent",border:`1px solid ${C.danger}40`,color:C.danger,fontFamily:font,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
      ✕ {label}
    </button>
  );
}


// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const C = {
  // Sidebar usa el primario oscuro
  sidebar:"#5a0f1a",   sidebarHover:"#6e1523",  sidebarActive:"#8B1E2E",
  sidebarText:"#f0c0c8", sidebarTextActive:"#ffffff",
  // Paleta original borravino
  primary:"#7E222E",  accent:"#ED6974",  mid:"#c06274",  soft:"#DD6674",
  dark:"#A75664",     bg:"#fdf6f7",      cardBg:"#ffffff", border:"#f0d5d8",
  textDark:"#3a0d14", textMid:"#7E222E", textLight:"#b07880",
  success:"#2d7a4f",  warning:"#b45309", danger:"#991b1b",
};
const font = "'Garamond', 'Times New Roman', Times, Georgia, serif";
const fontSerif = "'Garamond', 'Times New Roman', Times, serif";

const S = {
  app:{ fontFamily:font, minHeight:"100vh", background:C.bg, color:C.textDark, display:"flex" },
  // Layout sidebar
  sidebar:{ width:240, minWidth:240, background:C.sidebar, minHeight:"100vh", display:"flex", flexDirection:"column", position:"fixed", top:0, left:0, bottom:0, zIndex:100, overflowY:"auto" },
  sidebarLogo:{ padding:"24px 20px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)" },
  sidebarSection:{ fontSize:10, fontWeight:700, color:"rgba(200,216,228,0.5)", letterSpacing:"0.12em", textTransform:"uppercase", padding:"20px 20px 6px" },
  sidebarItem:(active)=>({ display:"flex", alignItems:"center", gap:10, padding:"9px 20px", cursor:"pointer", border:"none", width:"100%", textAlign:"left", background:active?C.sidebarActive:"transparent", color:active?C.sidebarTextActive:C.sidebarText, fontSize:13, fontWeight:active?600:400, borderRadius:0, transition:"all 0.12s", borderLeft:active?"3px solid #3aafa9":"3px solid transparent" }),
  // Main content
  main:{ marginLeft:240, flex:1, padding:"28px 36px", maxWidth:"calc(100% - 240px)", minHeight:"100vh" },
  pageHeader:{ marginBottom:28 },
  pageTitle:{ fontSize:24, fontWeight:700, color:C.textDark, margin:0, letterSpacing:"-0.02em" },
  pageSubtitle:{ fontSize:13, color:C.textLight, margin:"4px 0 0" },
  // Cards
  card:{ background:C.cardBg, borderRadius:12, padding:"22px 24px", boxShadow:"0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)", marginBottom:20, border:"none" },
  cardTitle:{ fontSize:15, fontWeight:700, color:C.textDark, marginBottom:16, marginTop:0, display:"flex", alignItems:"center", gap:8 },
  sectionTitle:{ fontSize:17, fontWeight:700, fontFamily:font, color:C.textDark, marginBottom:16, marginTop:0, display:"flex", alignItems:"center", gap:8 },
  // Forms
  label:{ fontSize:12, fontWeight:600, color:C.textMid, marginBottom:5, display:"block", letterSpacing:"0.02em" },
  input:{ width:"100%", padding:"9px 12px", border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:14, fontFamily:font, color:C.textDark, background:"#fff", boxSizing:"border-box", outline:"none", transition:"border 0.15s" },
  select:{ width:"100%", padding:"9px 12px", border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:14, fontFamily:font, color:C.textDark, background:"#fff", boxSizing:"border-box" },
  grid2:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 },
  grid3:{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:16 },
  grid4:{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12 },
  formGroup:{ marginBottom:16 },
  // Buttons
  btn:(v)=>({ padding:"9px 20px", borderRadius:8, border:"none", cursor:"pointer", fontSize:13, fontFamily:font, fontWeight:600, background:v==="primary"?C.primary:v==="success"?C.success:v==="danger"?C.danger:"#edf2f7", color:(v==="primary"||v==="success"||v==="danger")?"#fff":C.textMid, transition:"all 0.15s" }),
  badge:(color)=>({ display:"inline-flex", alignItems:"center", padding:"3px 10px", borderRadius:20, fontSize:11, fontWeight:600, fontFamily:font, background:color+"18", color, border:`1px solid ${color}33` }),
  // Stats
  indexBox:{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:12, padding:18, textAlign:"center", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" },
  barContainer:{ height:6, background:C.border, borderRadius:3, marginTop:8, overflow:"hidden" },
  bar:(pct,color)=>({ height:"100%", width:`${Math.min(Math.max(pct,0),100)}%`, background:color, borderRadius:3 }),
  // Topbar (dentro del main)
  topbar:{ background:C.cardBg, borderRadius:12, padding:"14px 20px", marginBottom:24, display:"flex", alignItems:"center", justifyContent:"space-between", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function classifyT(t) {
  if (t===null||t===undefined) return {label:"—",color:C.textLight};
  if (t>=65) return {label:"Clínicamente Elevado",color:C.danger};
  if (t>=60) return {label:"Borderline",color:C.warning};
  return {label:"Normal",color:C.success};
}
function erf(x){const a1=0.254829592,a2=-0.284496736,a3=1.421413741,a4=-1.453152027,a5=1.061405429,p=0.3275911;const sign=x<0?-1:1;x=Math.abs(x);const t2=1/(1+p*x);const y=1-(((((a5*t2+a4)*t2)+a3)*t2+a2)*t2+a1)*t2*Math.exp(-x*x);return sign*y;}
function tToPercent(t){const z=(t-50)/10;const pct=Math.round(50*(1+erf(z/Math.sqrt(2))));return Math.min(Math.max(pct,1),99);}
function lookupNearest(table,rawScore){if(!table)return null;const keys=Object.keys(table).map(Number).sort((a,b)=>a-b);if(rawScore<=keys[0])return table[keys[0]];if(rawScore>=keys[keys.length-1])return table[keys[keys.length-1]];let lo=keys[0];for(const k of keys){if(k<=rawScore)lo=k;}const idx=keys.indexOf(lo);if(idx<keys.length-1){const k1=keys[idx],k2=keys[idx+1],t1=table[k1],t2=table[k2];return Math.round(t1+(rawScore-k1)/(k2-k1)*(t2-t1));}return table[lo];}
function getAgeGroup(age,groups){for(const g of groups){const[lo,hi]=g.split("-").map(Number);if(age>=lo&&age<=hi)return g;}return null;}
function zScore(val,mean,sd){return val!==null&&val!==""&&!isNaN(val)?parseFloat(((parseFloat(val)-mean)/sd).toFixed(2)):null;}
function classifyZ(z,inverted=false){if(z===null||z===undefined||isNaN(z))return{label:"—",color:C.textLight};const eff=inverted?-z:z;if(eff>=-1)return{label:"Normal",color:C.success};if(eff>=-1.5)return{label:"Leve-Borderline",color:C.warning};if(eff>=-2)return{label:"Deterioro leve",color:"#b45309"};return{label:"Deterioro significativo",color:C.danger};}
function TBar({t}){const pct=((t-30)/50)*100;const{color}=classifyT(t);return <div style={S.barContainer}><div style={S.bar(pct,color)}/></div>;}

// ══════════════════════════════════════════════════════════════════════════════
// ─── BRIEF-A DATA ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const BRIEF_SCALES=[
  {key:"inhibit",label:"Inhibit",items:8,index:"BRI"},
  {key:"shift",label:"Shift",items:6,index:"BRI"},
  {key:"emotionalControl",label:"Control Emocional",items:10,index:"BRI"},
  {key:"selfMonitor",label:"Automonitoreo",items:6,index:"BRI"},
  {key:"initiate",label:"Iniciar",items:8,index:"MI"},
  {key:"workingMemory",label:"Memoria de Trabajo",items:10,index:"MI"},
  {key:"planOrganize",label:"Planif./Organizar",items:10,index:"MI"},
  {key:"taskMonitor",label:"Monitor de Tareas",items:6,index:"MI"},
  {key:"orgMaterials",label:"Org. de Materiales",items:6,index:"MI"},
];
const BRIEF_NORMS={
  inhibit:{"18-29":{8:38,9:40,10:42,11:44,12:46,13:48,14:50,15:52,16:54,17:57,18:59,19:61,20:63,21:65,22:68,23:70,24:72},"30-39":{8:37,9:39,10:41,11:43,12:46,13:48,14:50,15:52,16:55,17:57,18:59,19:62,20:64,21:66,22:69,23:71,24:73},"40-49":{8:37,9:39,10:41,11:43,12:46,13:48,14:50,15:52,16:55,17:57,18:59,19:62,20:64,21:66,22:69,23:71,24:73},"50-59":{8:36,9:38,10:41,11:43,12:45,13:47,14:50,15:52,16:55,17:57,18:60,19:62,20:65,21:67,22:70,23:72,24:74},"60-65":{8:35,9:37,10:40,11:42,12:45,13:47,14:50,15:53,16:55,17:58,18:61,19:63,20:66,21:68,22:71,23:73,24:76},"66-80":{8:35,9:37,10:40,11:42,12:45,13:47,14:50,15:53,16:55,17:58,18:61,19:63,20:66,21:68,22:71,23:73,24:76}},
  shift:{"18-29":{6:37,7:40,8:43,9:46,10:49,11:53,12:56,13:59,14:62,15:65,16:68,17:72,18:75},"30-39":{6:37,7:40,8:43,9:46,10:49,11:53,12:56,13:59,14:62,15:65,16:68,17:72,18:75},"40-49":{6:37,7:40,8:43,9:46,10:49,11:53,12:56,13:59,14:62,15:65,16:68,17:72,18:75},"50-59":{6:36,7:39,8:42,9:46,10:49,11:52,12:56,13:59,14:62,15:66,16:69,17:72,18:76},"60-65":{6:35,7:38,8:42,9:45,10:49,11:52,12:56,13:59,14:63,15:66,16:70,17:73,18:77},"66-80":{6:34,7:38,8:41,9:45,10:49,11:52,12:56,13:60,14:63,15:67,16:71,17:74,18:78}},
  emotionalControl:{"18-29":{10:36,11:38,12:40,13:42,14:44,15:46,16:48,17:50,18:52,19:54,20:56,21:58,22:60,23:62,24:64,25:66,26:68,27:70,28:72,29:75,30:77},"30-39":{10:36,11:38,12:40,13:42,14:44,15:46,16:48,17:50,18:52,19:54,20:56,21:58,22:60,23:62,24:64,25:66,26:68,27:70,28:72,29:75,30:77},"40-49":{10:36,11:38,12:40,13:42,14:44,15:46,16:48,17:50,18:52,19:54,20:56,21:58,22:60,23:62,24:64,25:66,26:68,27:70,28:72,29:75,30:77},"50-59":{10:35,11:37,12:39,13:41,14:43,15:45,16:47,17:50,18:52,19:54,20:56,21:58,22:61,23:63,24:65,25:67,26:69,27:72,28:74,29:76,30:78},"60-65":{10:34,11:36,12:38,13:40,14:43,15:45,16:47,17:50,18:52,19:54,20:57,21:59,22:61,23:64,24:66,25:68,26:71,27:73,28:75,29:78,30:80},"66-80":{10:33,11:35,12:38,13:40,14:42,15:45,16:47,17:50,18:52,19:55,20:57,21:60,22:62,23:64,24:67,25:69,26:72,27:74,28:76,29:79,30:81}},
  selfMonitor:{"18-29":{6:37,7:40,8:44,9:48,10:52,11:56,12:60,13:64,14:68,15:72,16:76,17:80,18:84},"30-39":{6:37,7:40,8:44,9:48,10:52,11:56,12:60,13:64,14:68,15:72,16:76,17:80,18:84},"40-49":{6:37,7:40,8:44,9:48,10:52,11:56,12:60,13:64,14:68,15:72,16:76,17:80,18:84},"50-59":{6:36,7:40,8:43,9:47,10:51,11:55,12:59,13:63,14:67,15:71,16:75,17:79,18:83},"60-65":{6:35,7:39,8:43,9:47,10:51,11:55,12:59,13:63,14:67,15:72,16:76,17:80,18:84},"66-80":{6:34,7:38,8:42,9:47,10:51,11:55,12:59,13:64,14:68,15:72,16:76,17:81,18:85}},
  initiate:{"18-29":{8:37,9:40,10:43,11:46,12:50,13:53,14:56,15:59,16:62,17:65,18:69,19:72,20:75,21:78,22:81,23:84,24:87},"30-39":{8:37,9:40,10:43,11:46,12:50,13:53,14:56,15:59,16:62,17:65,18:69,19:72,20:75,21:78,22:81,23:84,24:87},"40-49":{8:37,9:40,10:43,11:46,12:50,13:53,14:56,15:59,16:62,17:65,18:69,19:72,20:75,21:78,22:81,23:84,24:87},"50-59":{8:36,9:39,10:42,11:46,12:49,13:52,14:55,15:59,16:62,17:65,18:68,19:72,20:75,21:78,22:81,23:85,24:88},"60-65":{8:35,9:38,10:42,11:45,12:48,13:52,14:55,15:58,16:62,17:65,18:68,19:72,20:75,21:78,22:82,23:85,24:88},"66-80":{8:34,9:37,10:41,11:44,12:48,13:51,14:55,15:58,16:62,17:65,18:69,19:72,20:76,21:79,22:83,23:86,24:90}},
  workingMemory:{"18-29":{10:38,11:40,12:42,13:44,14:46,15:48,16:50,17:52,18:54,19:57,20:59,21:61,22:63,23:65,24:67,25:70,26:72,27:74,28:76,29:78,30:80},"30-39":{10:38,11:40,12:42,13:44,14:46,15:48,16:50,17:52,18:54,19:57,20:59,21:61,22:63,23:65,24:67,25:70,26:72,27:74,28:76,29:78,30:80},"40-49":{10:38,11:40,12:42,13:44,14:46,15:48,16:50,17:52,18:54,19:57,20:59,21:61,22:63,23:65,24:67,25:70,26:72,27:74,28:76,29:78,30:80},"50-59":{10:37,11:39,12:41,13:43,14:46,15:48,16:50,17:52,18:55,19:57,20:59,21:61,22:63,23:66,24:68,25:70,26:72,27:75,28:77,29:79,30:81},"60-65":{10:36,11:38,12:41,13:43,14:45,15:47,16:50,17:52,18:55,19:57,20:59,21:62,22:64,23:66,24:69,25:71,26:73,27:76,28:78,29:80,30:83},"66-80":{10:35,11:38,12:40,13:42,14:45,15:47,16:50,17:52,18:55,19:57,20:60,21:62,22:65,23:67,24:70,25:72,26:74,27:77,28:79,29:82,30:84}},
  planOrganize:{"18-29":{10:36,11:38,12:40,13:42,14:44,15:46,16:48,17:50,18:52,19:55,20:57,21:59,22:61,23:63,24:65,25:67,26:70,27:72,28:74,29:76,30:78},"30-39":{10:36,11:38,12:40,13:42,14:44,15:46,16:48,17:50,18:52,19:55,20:57,21:59,22:61,23:63,24:65,25:67,26:70,27:72,28:74,29:76,30:78},"40-49":{10:36,11:38,12:40,13:42,14:44,15:46,16:48,17:50,18:52,19:55,20:57,21:59,22:61,23:63,24:65,25:67,26:70,27:72,28:74,29:76,30:78},"50-59":{10:35,11:37,12:39,13:41,14:44,15:46,16:48,17:50,18:53,19:55,20:57,21:59,22:62,23:64,24:66,25:68,26:71,27:73,28:75,29:77,30:80},"60-65":{10:34,11:37,12:39,13:41,14:43,15:45,16:48,17:50,18:53,19:55,20:57,21:60,22:62,23:64,24:67,25:69,26:71,27:74,28:76,29:78,30:81},"66-80":{10:33,11:36,12:38,13:40,14:43,15:45,16:47,17:50,18:53,19:55,20:57,21:60,22:62,23:65,24:67,25:70,26:72,27:74,28:77,29:79,30:82}},
  taskMonitor:{"18-29":{6:37,7:41,8:45,9:49,10:53,11:57,12:61,13:65,14:69,15:73,16:77,17:81,18:85},"30-39":{6:37,7:41,8:45,9:49,10:53,11:57,12:61,13:65,14:69,15:73,16:77,17:81,18:85},"40-49":{6:37,7:41,8:45,9:49,10:53,11:57,12:61,13:65,14:69,15:73,16:77,17:81,18:85},"50-59":{6:36,7:40,8:44,9:48,10:53,11:57,12:61,13:65,14:69,15:73,16:78,17:82,18:86},"60-65":{6:35,7:39,8:44,9:48,10:52,11:57,12:61,13:65,14:70,15:74,16:78,17:83,18:87},"66-80":{6:34,7:39,8:43,9:47,10:52,11:56,12:61,13:65,14:70,15:74,16:79,17:83,18:88}},
  orgMaterials:{"18-29":{6:36,7:39,8:43,9:47,10:51,11:55,12:59,13:63,14:67,15:71,16:75,17:79,18:83},"30-39":{6:36,7:39,8:43,9:47,10:51,11:55,12:59,13:63,14:67,15:71,16:75,17:79,18:83},"40-49":{6:36,7:39,8:43,9:47,10:51,11:55,12:59,13:63,14:67,15:71,16:75,17:79,18:83},"50-59":{6:35,7:39,8:43,9:47,10:51,11:55,12:59,13:63,14:68,15:72,16:76,17:80,18:84},"60-65":{6:34,7:38,8:42,9:47,10:51,11:55,12:59,13:64,14:68,15:72,16:77,17:81,18:85},"66-80":{6:33,7:38,8:42,9:46,10:51,11:55,12:60,13:64,14:68,15:73,16:77,17:82,18:86}},
};
const BRIEF_INDEX_NORMS={
  BRI:{"18-29":{30:37,32:38,34:40,36:42,38:44,40:46,42:48,44:50,46:52,48:54,50:56,52:58,54:60,56:62,58:64,60:66,62:68,64:70,66:72,68:75,70:77,72:79,74:81},"30-39":{30:37,32:38,34:40,36:42,38:44,40:46,42:48,44:50,46:52,48:54,50:56,52:58,54:60,56:62,58:64,60:66,62:68,64:70,66:72,68:75,70:77,72:79,74:81},"40-49":{30:37,32:38,34:40,36:42,38:44,40:46,42:48,44:50,46:52,48:54,50:56,52:58,54:60,56:62,58:64,60:66,62:68,64:70,66:72,68:75,70:77,72:79,74:81},"50-59":{30:36,32:38,34:39,36:41,38:43,40:45,42:47,44:49,46:51,48:53,50:55,52:57,54:59,56:61,58:63,60:65,62:68,64:70,66:72,68:74,70:76,72:78,74:80},"60-65":{30:35,32:37,34:39,36:41,38:43,40:45,42:47,44:49,46:51,48:53,50:56,52:58,54:60,56:62,58:64,60:67,62:69,64:71,66:73,68:75,70:78,72:80,74:82},"66-80":{30:34,32:36,34:38,36:40,38:42,40:44,42:47,44:49,46:51,48:53,50:56,52:58,54:60,56:62,58:65,60:67,62:69,64:71,66:74,68:76,70:78,72:81,74:83}},
  MI:{"18-29":{40:36,45:38,50:43,55:47,60:51,65:56,70:59,75:63,80:67,85:72,90:76,95:80,100:83,105:87,108:90},"30-39":{40:36,45:38,50:43,55:47,60:51,65:56,70:59,75:63,80:67,85:72,90:76,95:80,100:83,105:87,108:90},"40-49":{40:36,45:38,50:43,55:47,60:51,65:56,70:59,75:63,80:67,85:72,90:76,95:80,100:83,105:87,108:90},"50-59":{40:35,45:37,50:42,55:46,60:50,65:55,70:58,75:62,80:66,85:71,90:75,95:79,100:82,105:86,108:89},"60-65":{40:34,45:36,50:41,55:45,60:50,65:54,70:58,75:62,80:66,85:71,90:75,95:79,100:83,105:87,108:91},"66-80":{40:33,45:35,50:40,55:44,60:49,65:54,70:58,75:63,80:67,85:72,90:76,95:80,100:84,105:88,108:92}},
  GEC:{"18-29":{70:36,80:41,90:47,100:53,110:59,120:65,130:71,140:76,150:82,160:88,170:94,180:100},"30-39":{70:36,80:41,90:47,100:53,110:59,120:65,130:71,140:76,150:82,160:88,170:94,180:100},"40-49":{70:36,80:41,90:47,100:53,110:59,120:65,130:71,140:76,150:82,160:88,170:94,180:100},"50-59":{70:35,80:41,90:46,100:52,110:58,120:64,130:70,140:76,150:81,160:87,170:93,180:99},"60-65":{70:34,80:40,90:46,100:52,110:58,120:64,130:70,140:76,150:82,160:88,170:94,180:101},"66-80":{70:33,80:39,90:45,100:52,110:58,120:64,130:71,140:77,150:83,160:90,170:96,180:103}},
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── STROOP DATA ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// FUENTE PRIMARIA: Galaverna y cols. (2014). Baremos argentinos por edad × escolaridad.
// Tabla 4: M y DE para Palabra (P), Color (C), Palabra-Color (PC) e Interferencia.
const STROOP_GALAVERNA={
  P:{
    Baja:{"18-45":{m:112.00,s:14.62},"46-65":{m:78.10,s:11.95},"66+":{m:68.73,s:22.38}},
    Media:{"18-45":{m:101.18,s:15.14},"46-65":{m:89.87,s:11.48},"66+":{m:83.83,s:26.00}},
    Alta:{"18-45":{m:103.75,s:15.89},"46-65":{m:99.38,s:16.92},"66+":{m:81.00,s:21.57}},
  },
  C:{
    Baja:{"18-45":{m:69.75,s:9.53},"46-65":{m:59.50,s:9.08},"66+":{m:46.91,s:17.33}},
    Media:{"18-45":{m:73.59,s:9.16},"46-65":{m:64.35,s:9.56},"66+":{m:55.67,s:14.73}},
    Alta:{"18-45":{m:74.99,s:12.52},"46-65":{m:74.08,s:13.97},"66+":{m:49.80,s:8.67}},
  },
  PC:{
    Baja:{"18-45":{m:34.25,s:9.70},"46-65":{m:31.30,s:6.76},"66+":{m:17.64,s:13.12}},
    Media:{"18-45":{m:43.47,s:14.25},"46-65":{m:35.30,s:8.98},"66+":{m:29.33,s:15.21}},
    Alta:{"18-45":{m:47.43,s:11.58},"46-65":{m:42.21,s:13.72},"66+":{m:24.00,s:6.51}},
  },
  Interf:{
    Baja:{"18-45":{m:-8.30,s:7.77},"46-65":{m:-2.24,s:8.42},"66+":{m:-10.06,s:9.92}},
    Media:{"18-45":{m:1.06,s:11.27},"46-65":{m:-1.97,s:7.04},"66+":{m:-3.81,s:8.37}},
    Alta:{"18-45":{m:4.14,s:9.40},"46-65":{m:-0.01,s:10.81},"66+":{m:-6.72,s:9.16}},
  },
};

function getStroopGalavernaAgeGroup(age){
  if(age>=18&&age<=45) return"18-45";
  if(age<=65) return"46-65";
  if(age>=66) return"66+";
  return null;
}

function getStroopEdLevel(education){
  if(!education) return null;
  const e=education.toLowerCase();
  if(e.includes("primario")) return"Baja";
  if(e.includes("secundario")) return"Media";
  if(e.includes("terciario")||e.includes("universitario")) return"Alta";
  return null;
}

// FUENTE SECUNDARIA: Golden (1994) — tabla T-scores para referencia internacional.
const STROOP_TABLE=[
  [20,48,35,15,-30],[22,52,38,17,-28],[24,56,41,19,-26],[26,60,44,21,-24],
  [28,64,47,23,-22],[30,68,50,25,-20],[32,72,53,27,-18],[34,76,56,29,-16],
  [36,80,59,31,-14],[38,84,62,33,-12],[40,88,65,35,-10],[42,92,68,37,-8],
  [44,96,71,39,-6],[46,100,74,41,-4],[48,104,77,43,-2],[50,108,80,45,0],
  [52,112,83,47,2],[54,116,86,49,4],[56,120,89,51,6],[58,124,92,53,8],
  [60,128,95,55,10],[62,132,98,57,12],[64,136,101,59,14],[66,140,104,61,16],
  [68,144,107,63,18],[70,148,110,65,20],[72,152,113,67,22],[74,156,116,69,24],
  [76,160,119,71,26],[78,164,122,73,28],[80,168,125,75,30],
];

function getStroopAgeCorr(age){
  if(age<45) return {P:0,C:0,PC:0};
  if(age<65) return {P:8,C:4,PC:5};
  return {P:14,C:11,PC:15};
}

function rawToTStroop(corrected,colIdx){
  const sorted=[...STROOP_TABLE].sort((a,b)=>a[colIdx]-b[colIdx]);
  for(let i=0;i<sorted.length-1;i++){
    const lo=sorted[i],hi=sorted[i+1];
    if(corrected>=lo[colIdx]&&corrected<=hi[colIdx]){
      const frac=(corrected-lo[colIdx])/(hi[colIdx]-lo[colIdx]);
      return Math.round(lo[0]+frac*(hi[0]-lo[0]));
    }
  }
  if(corrected<=sorted[0][colIdx]) return sorted[0][0];
  return sorted[sorted.length-1][0];
}

function interferenceTStroop(intVal){
  const sorted=[...STROOP_TABLE].sort((a,b)=>a[4]-b[4]);
  for(let i=0;i<sorted.length-1;i++){
    const lo=sorted[i],hi=sorted[i+1];
    if(intVal>=lo[4]&&intVal<=hi[4]){
      const frac=(intVal-lo[4])/(hi[4]-lo[4]);
      return Math.round(lo[0]+frac*(hi[0]-lo[0]));
    }
  }
  if(intVal<=sorted[0][4]) return sorted[0][0];
  return sorted[sorted.length-1][0];
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── RAVLT DATA ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// Fuente: protocolo_con_baremos.pdf · Adaptación argentina (Rey, 1964/1994)
const RAVLT_ADULT_NORMS={
  "16-19":{A1:{m:6.9,s:1.8},A2:{m:9.7,s:1.7},A3:{m:11.5,s:1.2},A4:{m:12.8,s:1.5},A5:{m:12.5,s:1.3},total:{m:53.4,s:2.4},B1:{m:6.9,s:1.9},A6:{m:11.2,s:1.6},A7:{m:11.3,s:1.7}},
  "20-29":{A1:{m:8.4,s:1.2},A2:{m:10.8,s:1.9},A3:{m:11.3,s:1.6},A4:{m:12.2,s:1.8},A5:{m:12.2,s:2.2},total:{m:54.9,s:7.0},B1:{m:6.5,s:1.8},A6:{m:11.1,s:1.7},A7:{m:10.6,s:2.4}},
  "30-39":{A1:{m:6.0,s:1.8},A2:{m:8.0,s:2.4},A3:{m:9.7,s:2.6},A4:{m:10.9,s:2.8},A5:{m:11.4,s:2.6},total:{m:46.0,s:10.9},B1:{m:5.3,s:1.6},A6:{m:9.7,s:2.3},A7:{m:10.4,s:2.3}},
  "40-49":{A1:{m:6.4,s:1.8},A2:{m:9.0,s:2.3},A3:{m:9.8,s:2.0},A4:{m:11.5,s:1.9},A5:{m:10.9,s:2.6},total:{m:47.5,s:8.3},B1:{m:6.1,s:2.1},A6:{m:9.6,s:2.5},A7:{m:10.5,s:2.7}},
  "50-59":{A1:{m:4.9,s:2.0},A2:{m:8.6,s:2.0},A3:{m:10.1,s:1.6},A4:{m:10.7,s:1.9},A5:{m:11.8,s:2.6},total:{m:47.6,s:8.5},B1:{m:5.0,s:2.3},A6:{m:9.2,s:2.9},A7:{m:10.0,s:2.6}},
  "60-69":{A1:{m:4.9,s:1.1},A2:{m:6.4,s:1.2},A3:{m:8.0,s:2.6},A4:{m:8.5,s:2.7},A5:{m:8.9,s:2.0},total:{m:36.7,s:8.4},B1:{m:4.9,s:1.6},A6:{m:7.2,s:2.8},A7:{m:7.1,s:3.8}},
  "70+":{A1:{m:3.6,s:0.8},A2:{m:5.7,s:1.7},A3:{m:6.8,s:1.6},A4:{m:8.3,s:2.7},A5:{m:8.2,s:2.5},total:{m:32.6,s:8.3},B1:{m:3.5,s:1.3},A6:{m:6.4,s:1.7},A7:{m:5.6,s:2.6}},
};

const RAVLT_CHILD_NORMS={
  5:{I:{m:4,s:1},V:{m:8,s:2},D:{m:6,s:1}},
  6:{I:{m:4,s:1},V:{m:9,s:2},D:{m:7,s:1}},
  7:{I:{m:5,s:1},V:{m:10,s:2},D:{m:8,s:1}},
  8:{I:{m:6,s:1},V:{m:11,s:2},D:{m:9,s:2}},
  9:{I:{m:7,s:2},V:{m:12,s:2},D:{m:10,s:2}},
  10:{I:{m:8,s:2},V:{m:13,s:2},D:{m:10,s:2}},
  11:{I:{m:7,s:2},V:{m:13,s:2},D:{m:11,s:2}},
  12:{I:{m:8,s:2},V:{m:13,s:2},D:{m:11,s:2}},
  13:{I:{m:8,s:2},V:{m:15,s:1},D:{m:12,s:2}},
  14:{I:{m:8,s:2},V:{m:15,s:1},D:{m:12,s:2}},
};

function getRavltAdultGroup(age){
  if(age<16) return null;
  if(age<=19) return "16-19";
  if(age<=29) return "20-29";
  if(age<=39) return "30-39";
  if(age<=49) return "40-49";
  if(age<=59) return "50-59";
  if(age<=69) return "60-69";
  return "70+";
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── TAVEC DATA ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// Benedet & Alejandre (1998). TAVEC. Madrid: TEA Ediciones.
// Baremos españoles. Para uso clínico en Argentina se recomienda comparar con
// datos propios o adaptar con muestra local si está disponible.
const TAVEC_NORMS={
  "20-39":{
    A1:{m:7.8,s:2.1},A2:{m:10.9,s:2.3},A3:{m:12.4,s:2.2},A4:{m:13.4,s:2.1},A5:{m:13.9,s:1.8},
    total:{m:58.4,s:8.8},B:{m:7.6,s:2.4},
    rlc:{m:12.1,s:2.8},rcc:{m:13.5,s:2.3},
    rlld:{m:12.6,s:2.9},rcld:{m:13.7,s:2.4},
    recog:{m:15.8,s:0.5},intLC:{m:1.2,s:1.4},intLD:{m:1.0,s:1.2},
  },
  "40-54":{
    A1:{m:7.0,s:2.2},A2:{m:10.0,s:2.5},A3:{m:11.5,s:2.5},A4:{m:12.5,s:2.4},A5:{m:12.9,s:2.5},
    total:{m:53.9,s:10.3},B:{m:7.2,s:2.5},
    rlc:{m:11.0,s:3.0},rcc:{m:12.5,s:2.7},
    rlld:{m:11.5,s:3.5},rcld:{m:12.8,s:2.8},
    recog:{m:15.4,s:0.9},intLC:{m:1.5,s:1.6},intLD:{m:1.4,s:1.5},
  },
  "55-70":{
    A1:{m:6.2,s:2.5},A2:{m:8.8,s:2.8},A3:{m:10.4,s:2.9},A4:{m:11.3,s:3.0},A5:{m:11.8,s:3.2},
    total:{m:47.6,s:12.5},B:{m:6.8,s:2.6},
    rlc:{m:9.5,s:3.3},rcc:{m:11.2,s:3.0},
    rlld:{m:9.9,s:4.0},rcld:{m:11.5,s:3.2},
    recog:{m:14.9,s:1.5},intLC:{m:1.8,s:1.8},intLD:{m:1.7,s:1.7},
  },
};

function getTavecAgeGroup(age){
  if(age>=20&&age<=39) return "20-39";
  if(age>=40&&age<=54) return "40-54";
  if(age>=55&&age<=70) return "55-70";
  return null;
}

const TAVEC_MEASURES=[
  {key:"A1",label:"Lista A — Ensayo 1",max:16,note:"Primer recuerdo libre de Lista A"},
  {key:"A2",label:"Lista A — Ensayo 2",max:16,note:""},
  {key:"A3",label:"Lista A — Ensayo 3",max:16,note:""},
  {key:"A4",label:"Lista A — Ensayo 4",max:16,note:""},
  {key:"A5",label:"Lista A — Ensayo 5",max:16,note:"Máximo aprendizaje"},
  {key:"total",label:"Total A1-A5",max:80,note:"Suma de los 5 ensayos"},
  {key:"B",label:"Lista B (Interferencia)",max:16,note:"Recuerdo de lista interferente"},
  {key:"rlc",label:"Recuerdo Libre Corto Plazo",max:16,note:"Post-B, sin demora"},
  {key:"rcc",label:"Recuerdo con Claves Corto Plazo",max:16,note:"Con claves semánticas"},
  {key:"rlld",label:"Recuerdo Libre Largo Plazo",max:16,note:"~20 min de demora"},
  {key:"rcld",label:"Recuerdo con Claves Largo Plazo",max:16,note:"Con claves semánticas"},
  {key:"recog",label:"Reconocimiento",max:16,note:"Aciertos en lista de reconocimiento"},
];

// ══════════════════════════════════════════════════════════════════════════════
// ─── WMS-3 DATA ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// Wechsler (1997). WMS-III. Adaptación española: TEA Ediciones (1998).
// Puntuaciones de índice: M=100, DS=15. Interpretación por bandas.
const WMS3_INDEXES=[
  {key:"mai",  label:"Memoria Auditiva Inmediata (MAI)",   short:"MAI",  comp:"Memoria Lógica I + Pares de Palabras I",  color:"#1d4ed8"},
  {key:"mvi",  label:"Memoria Visual Inmediata (MVI)",     short:"MVI",  comp:"Caras I + Fotografías Familiares I",       color:"#0891b2"},
  {key:"mi",   label:"Memoria Inmediata (MI)",             short:"MI",   comp:"MAI + MVI (compuesto global inmediato)",  color:"#6d28d9"},
  {key:"mad",  label:"Memoria Auditiva Demorada (MAD)",    short:"MAD",  comp:"Memoria Lógica II + Pares de Palabras II",color:"#1d4ed8"},
  {key:"mvd",  label:"Memoria Visual Demorada (MVD)",      short:"MVD",  comp:"Caras II + Fotografías Familiares II",    color:"#0891b2"},
  {key:"rad",  label:"Reconoc. Auditivo Demorado (RAD)",   short:"RAD",  comp:"Reconocimiento ML II + PdP II",           color:"#047857"},
  {key:"mg",   label:"Memoria General (MG)",               short:"MG",   comp:"MAD + MVD (compuesto global demorado)",  color:"#6d28d9"},
  {key:"mt",   label:"Memoria de Trabajo (MT)",            short:"MT",   comp:"Amplitud de Dígitos + Secuencias L-N",   color:"#b45309"},
];

const WMS3_BANDS=[
  {min:130,label:"Muy superior",   color:"#14532d",pct:"≥98"},
  {min:120,label:"Superior",       color:"#166534",pct:"91-97"},
  {min:110,label:"Promedio alto",  color:"#1a7a3c",pct:"75-90"},
  {min:90, label:"Promedio",       color:C.success, pct:"25-74"},
  {min:80, label:"Promedio bajo",  color:C.warning, pct:"9-24"},
  {min:70, label:"Límite",         color:"#b45309", pct:"2-8"},
  {min:0,  label:"Extremadamente bajo",color:C.danger,pct:"<2"},
];

function classifyWMS(score){
  if(score===null||score==="") return{label:"—",color:C.textLight};
  const s=parseInt(score);
  for(const b of WMS3_BANDS){if(s>=b.min) return {...b,score:s};}
  return {...WMS3_BANDS[WMS3_BANDS.length-1],score:s};
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── OTHER EXISTING DATA ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
const MOCA_DOMAINS=[
  {key:"visuospacial",label:"Visuoespacial/Ejecutivo",maxScore:5,desc:"Alternancia, cubo, reloj"},
  {key:"naming",label:"Denominación",maxScore:3,desc:"3 animales"},
  {key:"attention",label:"Atención",maxScore:6,desc:"Dígitos, tarea sostenida, sustracciones"},
  {key:"language",label:"Lenguaje",maxScore:3,desc:"Repetición de frases, fluencia verbal"},
  {key:"abstraction",label:"Abstracción",maxScore:2,desc:"Semejanzas"},
  {key:"memory",label:"Memoria diferida",maxScore:5,desc:"Recuerdo libre de 5 palabras"},
  {key:"orientation",label:"Orientación",maxScore:6,desc:"Fecha, mes, año, día, lugar, ciudad"},
];

const BADS_SUBTESTS=[
  {key:"cambioReglas",label:"Cambio de Reglas",max:4},{key:"programaAccion",label:"Programa de Acción",max:4},
  {key:"busquedaLlave",label:"Búsqueda de la Llave",max:4},{key:"juicioTemporal",label:"Juicio Temporal",max:4},
  {key:"mapaZoo",label:"Mapa del Zoológico",max:4},{key:"seisElementos",label:"Seis Elementos",max:4},
];

// ══════════════════════════════════════════════════════════════════════════════
// ─── WCST ABREVIADO (64 CARTAS) — AXELROD ET AL. (1993) ─────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// Tabla 1: M y DS por grupo de década (20s-80s). n=20/grupo.
// Categorías: mayor = mejor (inverted=false). Errores: mayor = peor (inverted=true).
const WCST_NORMS={
  "20-29":{categories:{m:4.1,s:0.8},totalErrors:{m:14.5,s:5.1},persevResponses:{m:9.2,s:4.3},persevErrors:{m:8.2,s:3.6},nonpersevErrors:{m:6.2,s:2.8}},
  "30-39":{categories:{m:3.2,s:1.3},totalErrors:{m:20.0,s:9.7},persevResponses:{m:11.8,s:6.1},persevErrors:{m:11.0,s:5.7},nonpersevErrors:{m:9.0,s:5.3}},
  "40-49":{categories:{m:3.6,s:1.1},totalErrors:{m:18.4,s:7.8},persevResponses:{m:12.2,s:5.5},persevErrors:{m:11.7,s:7.0},nonpersevErrors:{m:7.7,s:3.7}},
  "50-59":{categories:{m:3.4,s:1.3},totalErrors:{m:16.6,s:7.6},persevResponses:{m:10.2,s:5.3},persevErrors:{m:8.4,s:4.2},nonpersevErrors:{m:7.7,s:4.4}},
  "60-69":{categories:{m:2.6,s:1.7},totalErrors:{m:21.3,s:11.6},persevResponses:{m:13.5,s:8.5},persevErrors:{m:12.0,s:7.6},nonpersevErrors:{m:9.4,s:6.3}},
  "70-79":{categories:{m:2.6,s:1.1},totalErrors:{m:22.8,s:6.0},persevResponses:{m:14.8,s:5.4},persevErrors:{m:12.7,s:4.3},nonpersevErrors:{m:10.7,s:5.0}},
  "80-89":{categories:{m:2.2,s:1.6},totalErrors:{m:25.7,s:10.8},persevResponses:{m:20.4,s:13.2},persevErrors:{m:16.2,s:10.1},nonpersevErrors:{m:9.0,s:4.3}},
};
function getWCSTAgeGroup(age){
  if(age>=20&&age<=29)return"20-29";if(age>=30&&age<=39)return"30-39";
  if(age>=40&&age<=49)return"40-49";if(age>=50&&age<=59)return"50-59";
  if(age>=60&&age<=69)return"60-69";if(age>=70&&age<=79)return"70-79";
  if(age>=80)return"80-89";return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── IFS (INECO FRONTAL SCREENING) — TORRALVA ET AL. (2009) ─────────────────
// ══════════════════════════════════════════════════════════════════════════════
// 8 subtests. Puntaje total /30. Índice MT (Dígitos + Corsi) /10.
// Punto de corte clínico: 25 (sensibilidad 96.2%, especificidad 91.5%)
const IFS_SUBTESTS=[
  {key:"motorSeries",label:"Series Motoras",max:3,desc:"Secuencia de Luria: puño-canto-palma. 6 series solo=3; ≥3 solo=2; con examinador=1; no logra=0."},
  {key:"conflictInstr",label:"Instrucciones Conflictivas",max:3,desc:"Golpear 2 cuando examinador golpea 1, y viceversa. Sin error=3; 1-2 errores=2; >2 errores=1; copia examinador ≥4 veces=0."},
  {key:"goNogo",label:"Control Inhibitorio Motor (Go-No Go)",max:3,desc:"Golpear 1 cuando examinador golpea 1; NO golpear cuando golpea 2. Sin error=3; 1-2 errores=2; >2 errores=1; copia ≥4 veces=0."},
  {key:"digitsBack",label:"Dígitos en Orden Inverso",max:6,desc:"Repetir series de dígitos en orden inverso. Puntaje = mayor span logrado en cualquiera de los 2 intentos."},
  {key:"monthsBack",label:"Meses Atrás",max:2,desc:"Enumerar los 12 meses del año en orden inverso desde diciembre. Sin error=2; 1 error=1; >1 error=0."},
  {key:"spatialWT",label:"Memoria de Trabajo Visual (Corsi)",max:4,desc:"Señalar cubos en secuencia, paciente repite en orden inverso. Puntaje = n° de trials correctos (2, 3, 4 y 5 cubos)."},
  {key:"proverbs",label:"Refranes (Abstracción)",max:3,desc:"Interpretación abstracta de 3 refranes. Explicación correcta=1 pto; ejemplo correcto=0.5 pto; concreta=0 pto."},
  {key:"verbInhibit",label:"Control Inhibitorio Verbal (Hayling)",max:6,desc:"Solo se puntúa la Fase 2 (inhibición). Palabra no relacionada=2; relacionada semánticamente=1; palabra esperada=0. Máx. 6."},
];
const IFS_CUTOFF=25;

// ══════════════════════════════════════════════════════════════════════════════
// ─── WAIS-IV — Wechsler (2008) / Estandarización Chile: Rosas et al. ────────
// ══════════════════════════════════════════════════════════════════════════════
// Puntajes compuestos (Índices + CIT): M=100, DS=15. Subtests: M=10, DS=3.
// Tabla 4.1: Descriptores de rendimiento para CIT e Índices.
const WAIS_INDEXES=[
  {key:"cit", label:"CIT — Escala Total",                short:"CIT", sem:3.6, color:"#1d4ed8"},
  {key:"icv", label:"ICV — Comprensión Verbal",          short:"ICV", sem:4.6, color:C.primary},
  {key:"irp", label:"IRP — Razonamiento Perceptual",     short:"IRP", sem:5.1, color:"#6d28d9"},
  {key:"imt", label:"IMT — Memoria de Trabajo",          short:"IMT", sem:4.6, color:C.success},
  {key:"ivp", label:"IVP — Velocidad de Procesamiento",  short:"IVP", sem:5.6, color:"#0891b2"},
];
// Subpruebas centrales (y SLN suplementaria) con su índice de pertenencia
const WAIS_SUBTESTS=[
  {key:"cc",  label:"Construcción con Cubos (CC)",        idx:"irp"},
  {key:"an",  label:"Analogías (An)",                     idx:"icv"},
  {key:"rd",  label:"Retención de Dígitos (RD)",          idx:"imt"},
  {key:"mr",  label:"Matrices (MR)",                      idx:"irp"},
  {key:"voc", label:"Vocabulario (Voc)",                  idx:"icv"},
  {key:"ari", label:"Aritmética (Ari)",                   idx:"imt"},
  {key:"bs",  label:"Búsqueda de Símbolos (BS)",          idx:"ivp"},
  {key:"rv",  label:"Rompecabezas Visual (RV)",           idx:"irp"},
  {key:"cla", label:"Clave de Números (Cla)",             idx:"ivp"},
  {key:"sln", label:"Sec. Letras-Números (SLN) ★ supl.", idx:"imt"},
];
// Clasificación para puntajes compuestos (M=100, DS=15) — Tabla 4.1
function classifyWAIS(score){
  const s=parseInt(score);
  if(isNaN(s)||s===0) return{label:"—",color:C.textLight};
  if(s>=130) return{label:"Muy superior",color:"#1d4ed8"};
  if(s>=120) return{label:"Superior",color:"#2563eb"};
  if(s>=110) return{label:"Sobre el promedio",color:C.success};
  if(s>=90)  return{label:"Promedio",color:C.textMid};
  if(s>=80)  return{label:"Bajo el promedio",color:C.warning};
  if(s>=70)  return{label:"Limítrofe",color:"#b45309"};
  return{label:"Muy bajo",color:C.danger};
}
// Clasificación para puntajes escalares de subpruebas (M=10, DS=3)
function classifyWAISSubtest(score){
  const s=parseInt(score);
  if(isNaN(s)||s===0) return{label:"—",color:C.textLight};
  if(s>=14) return{label:"Muy superior",color:"#1d4ed8"};
  if(s>=12) return{label:"Superior",color:"#2563eb"};
  if(s>=11) return{label:"Sobre el promedio",color:C.success};
  if(s>=9)  return{label:"Promedio",color:C.textMid};
  if(s>=8)  return{label:"Bajo el promedio",color:C.warning};
  if(s>=7)  return{label:"Limítrofe",color:"#b45309"};
  return{label:"Muy bajo",color:C.danger};
}
// Percentil desde puntaje compuesto usando distribución normal M=100, DS=15
function waisPct(score){
  const s=parseInt(score);
  if(isNaN(s)) return null;
  return Math.min(99,Math.max(1,Math.round((1+erf((s-100)/(15*Math.sqrt(2))))/2*100)));
}
// Intervalo de confianza al 95% usando SEM del índice
function waisCI(score,sem){
  const s=parseInt(score);
  if(isNaN(s)) return null;
  return{lo:Math.round(s-1.96*sem),hi:Math.round(s+1.96*sem)};
}


// ── WAIS-IV Bruto → PE (Rosas & Pizarro, adaptación chilena — valores aproximados)
// PE = max(1, min(19, round(10 + 3*(bruto-M)/SD)))  — Verificar con el manual
const WAIS_BRUTO_NORMS={
  cc: {"16-17":{m:29,sd:9},"18-19":{m:31,sd:9},"20-24":{m:32,sd:9},"25-29":{m:32,sd:9},"30-34":{m:31,sd:9},"35-44":{m:29,sd:9},"45-54":{m:26,sd:9},"55-64":{m:22,sd:8},"65-69":{m:19,sd:8},"70-74":{m:16,sd:7},"75-79":{m:14,sd:7},"80-84":{m:11,sd:6},"85-90":{m:9,sd:6}},
  an: {"16-17":{m:17,sd:5},"18-19":{m:19,sd:4},"20-24":{m:21,sd:4},"25-29":{m:21,sd:4},"30-34":{m:21,sd:4},"35-44":{m:21,sd:4},"45-54":{m:20,sd:4},"55-64":{m:19,sd:4},"65-69":{m:17,sd:4},"70-74":{m:16,sd:4},"75-79":{m:14,sd:4},"80-84":{m:13,sd:4},"85-90":{m:11,sd:4}},
  rd: {"16-17":{m:19,sd:4},"18-19":{m:21,sd:4},"20-24":{m:22,sd:4},"25-29":{m:22,sd:4},"30-34":{m:22,sd:4},"35-44":{m:21,sd:4},"45-54":{m:20,sd:4},"55-64":{m:19,sd:4},"65-69":{m:18,sd:4},"70-74":{m:17,sd:4},"75-79":{m:16,sd:4},"80-84":{m:14,sd:4},"85-90":{m:13,sd:4}},
  mr: {"16-17":{m:19,sd:5},"18-19":{m:21,sd:5},"20-24":{m:22,sd:5},"25-29":{m:21,sd:5},"30-34":{m:20,sd:5},"35-44":{m:19,sd:5},"45-54":{m:17,sd:5},"55-64":{m:14,sd:5},"65-69":{m:12,sd:5},"70-74":{m:11,sd:5},"75-79":{m:9,sd:4},"80-84":{m:8,sd:4},"85-90":{m:7,sd:4}},
  voc:{"16-17":{m:30,sd:8},"18-19":{m:34,sd:8},"20-24":{m:36,sd:8},"25-29":{m:38,sd:8},"30-34":{m:40,sd:8},"35-44":{m:41,sd:8},"45-54":{m:41,sd:8},"55-64":{m:40,sd:8},"65-69":{m:38,sd:8},"70-74":{m:37,sd:8},"75-79":{m:35,sd:8},"80-84":{m:33,sd:8},"85-90":{m:30,sd:8}},
  ari:{"16-17":{m:14,sd:4},"18-19":{m:16,sd:4},"20-24":{m:18,sd:4},"25-29":{m:18,sd:4},"30-34":{m:18,sd:4},"35-44":{m:18,sd:4},"45-54":{m:17,sd:4},"55-64":{m:16,sd:4},"65-69":{m:15,sd:4},"70-74":{m:14,sd:4},"75-79":{m:13,sd:4},"80-84":{m:12,sd:4},"85-90":{m:11,sd:4}},
  bs: {"16-17":{m:18,sd:5},"18-19":{m:20,sd:5},"20-24":{m:22,sd:5},"25-29":{m:21,sd:5},"30-34":{m:21,sd:5},"35-44":{m:20,sd:5},"45-54":{m:17,sd:5},"55-64":{m:14,sd:5},"65-69":{m:12,sd:5},"70-74":{m:10,sd:5},"75-79":{m:9,sd:4},"80-84":{m:8,sd:4},"85-90":{m:7,sd:4}},
  rv: {"16-17":{m:12,sd:4},"18-19":{m:13,sd:4},"20-24":{m:14,sd:4},"25-29":{m:14,sd:4},"30-34":{m:14,sd:4},"35-44":{m:13,sd:4},"45-54":{m:12,sd:4},"55-64":{m:11,sd:4},"65-69":{m:10,sd:4},"70-74":{m:9,sd:3},"75-79":{m:8,sd:3},"80-84":{m:7,sd:3},"85-90":{m:6,sd:3}},
  cla:{"16-17":{m:55,sd:14},"18-19":{m:63,sd:14},"20-24":{m:70,sd:14},"25-29":{m:68,sd:14},"30-34":{m:66,sd:14},"35-44":{m:62,sd:14},"45-54":{m:54,sd:14},"55-64":{m:44,sd:13},"65-69":{m:37,sd:12},"70-74":{m:31,sd:11},"75-79":{m:26,sd:10},"80-84":{m:22,sd:9},"85-90":{m:18,sd:8}},
  sln:{"16-17":{m:16,sd:4},"18-19":{m:18,sd:4},"20-24":{m:19,sd:4},"25-29":{m:19,sd:4},"30-34":{m:19,sd:4},"35-44":{m:18,sd:4},"45-54":{m:17,sd:4},"55-64":{m:16,sd:4},"65-69":{m:14,sd:4},"70-74":{m:13,sd:4},"75-79":{m:12,sd:4},"80-84":{m:11,sd:4},"85-90":{m:10,sd:4}},
};
function waisBrutoToPE(bruto,subtest,ageGroup){
  const n=WAIS_BRUTO_NORMS[subtest]?.[ageGroup];
  if(!n||bruto===null||bruto===undefined||bruto==="") return null;
  return Math.max(1,Math.min(19,Math.round(10+3*(parseFloat(bruto)-n.m)/n.sd)));
}
const WAIS_SUBTEST_LABELS={cc:"Construcción con Cubos",an:"Analogías",rd:"Retención de Dígitos",mr:"Matrices",voc:"Vocabulario",ari:"Aritmética",bs:"Búsqueda de Símbolos",rv:"Rompecabezas Visual",cla:"Clave de Números",sln:"Sec. Letras-Números ★"};
const WAIS_SUBTEST_IDX={cc:"irp",an:"icv",rd:"imt",mr:"irp",voc:"icv",ari:"imt",bs:"ivp",rv:"irp",cla:"ivp",sln:"imt"};
const WAIS_SUBTEST_MAX={cc:66,an:26,rd:48,mr:26,voc:68,ari:26,bs:60,rv:24,cla:135,sln:30};
const WAIS_AGE_GROUPS=["16-17","18-19","20-24","25-29","30-34","35-44","45-54","55-64","65-69","70-74","75-79","80-84","85-90"];

// ── WISC-V Bruto → PE (Rosas & Pizarro, Chile — valores aproximados por edad en años)
// PE = max(1, min(19, round(10 + 3*(bruto-M)/SD)))
const WISC5_BRUTO_NORMS={
  CC: {6:{m:14,sd:7},7:{m:22,sd:8},8:{m:30,sd:8},9:{m:36,sd:8},10:{m:41,sd:8},11:{m:45,sd:8},12:{m:48,sd:8},13:{m:51,sd:8},14:{m:53,sd:8},15:{m:54,sd:7},16:{m:55,sd:7}},
  AN: {6:{m:9,sd:4},7:{m:13,sd:4},8:{m:16,sd:4},9:{m:18,sd:4},10:{m:20,sd:4},11:{m:21,sd:4},12:{m:22,sd:4},13:{m:23,sd:3},14:{m:24,sd:3},15:{m:24,sd:3},16:{m:25,sd:3}},
  MR: {6:{m:9,sd:4},7:{m:12,sd:4},8:{m:15,sd:4},9:{m:17,sd:4},10:{m:19,sd:4},11:{m:20,sd:4},12:{m:21,sd:4},13:{m:22,sd:4},14:{m:23,sd:4},15:{m:24,sd:4},16:{m:25,sd:4}},
  RD: {6:{m:10,sd:3},7:{m:12,sd:3},8:{m:13,sd:3},9:{m:15,sd:3},10:{m:16,sd:3},11:{m:17,sd:3},12:{m:18,sd:3},13:{m:19,sd:3},14:{m:20,sd:3},15:{m:21,sd:3},16:{m:22,sd:3}},
  CLA:{6:{m:24,sd:8},7:{m:34,sd:9},8:{m:43,sd:10},9:{m:51,sd:10},10:{m:57,sd:11},11:{m:62,sd:11},12:{m:67,sd:11},13:{m:71,sd:11},14:{m:74,sd:11},15:{m:77,sd:11},16:{m:79,sd:11}},
  VOC:{6:{m:11,sd:5},7:{m:15,sd:5},8:{m:18,sd:5},9:{m:20,sd:5},10:{m:22,sd:5},11:{m:23,sd:5},12:{m:24,sd:5},13:{m:25,sd:5},14:{m:26,sd:5},15:{m:27,sd:5},16:{m:28,sd:5}},
  BAL:{6:{m:13,sd:4},7:{m:16,sd:4},8:{m:18,sd:4},9:{m:20,sd:4},10:{m:21,sd:4},11:{m:22,sd:4},12:{m:23,sd:4},13:{m:24,sd:4},14:{m:25,sd:4},15:{m:25,sd:4},16:{m:26,sd:4}},
  RV: {6:{m:8,sd:3},7:{m:10,sd:3},8:{m:12,sd:3},9:{m:13,sd:3},10:{m:14,sd:3},11:{m:15,sd:3},12:{m:16,sd:3},13:{m:17,sd:3},14:{m:17,sd:3},15:{m:18,sd:3},16:{m:18,sd:3}},
  RI: {6:{m:8,sd:3},7:{m:10,sd:3},8:{m:12,sd:3},9:{m:13,sd:3},10:{m:14,sd:3},11:{m:15,sd:3},12:{m:16,sd:3},13:{m:17,sd:3},14:{m:17,sd:3},15:{m:18,sd:3},16:{m:18,sd:3}},
  BS: {6:{m:9,sd:4},7:{m:13,sd:5},8:{m:17,sd:5},9:{m:20,sd:5},10:{m:23,sd:5},11:{m:25,sd:5},12:{m:27,sd:5},13:{m:29,sd:5},14:{m:31,sd:5},15:{m:32,sd:5},16:{m:33,sd:5}},
  INF:{6:{m:8,sd:3},7:{m:11,sd:3},8:{m:13,sd:3},9:{m:15,sd:3},10:{m:17,sd:3},11:{m:18,sd:3},12:{m:19,sd:3},13:{m:20,sd:3},14:{m:21,sd:3},15:{m:22,sd:3},16:{m:22,sd:3}},
  SLN:{6:{m:8,sd:3},7:{m:10,sd:3},8:{m:12,sd:3},9:{m:14,sd:3},10:{m:16,sd:3},11:{m:17,sd:3},12:{m:18,sd:3},13:{m:19,sd:3},14:{m:20,sd:3},15:{m:21,sd:3},16:{m:22,sd:3}},
  CAN:{6:{m:9,sd:4},7:{m:12,sd:4},8:{m:15,sd:4},9:{m:18,sd:4},10:{m:21,sd:4},11:{m:23,sd:4},12:{m:25,sd:4},13:{m:27,sd:4},14:{m:28,sd:4},15:{m:29,sd:4},16:{m:30,sd:4}},
  COM:{6:{m:11,sd:4},7:{m:14,sd:4},8:{m:16,sd:4},9:{m:18,sd:4},10:{m:19,sd:4},11:{m:20,sd:4},12:{m:21,sd:4},13:{m:22,sd:4},14:{m:23,sd:4},15:{m:23,sd:4},16:{m:24,sd:4}},
  ARI:{6:{m:6,sd:3},7:{m:9,sd:3},8:{m:12,sd:3},9:{m:14,sd:3},10:{m:16,sd:3},11:{m:17,sd:3},12:{m:18,sd:3},13:{m:19,sd:3},14:{m:20,sd:3},15:{m:21,sd:3},16:{m:22,sd:3}},
};
function wisc5BrutoToPE(bruto,subtest,ageYears){
  const n=WISC5_BRUTO_NORMS[subtest]?.[ageYears];
  if(!n||bruto===null||bruto===undefined||bruto==="") return null;
  return Math.max(1,Math.min(19,Math.round(10+3*(parseFloat(bruto)-n.m)/n.sd)));
}

const TMT_AGE_NORMS={
  "18-24":{A:{mean:23.8,sd:10.0},B:{mean:51.4,sd:20.5}},"25-29":{A:{mean:24.5,sd:10.2},B:{mean:54.0,sd:21.5}},
  "30-34":{A:{mean:25.8,sd:11.0},B:{mean:57.2,sd:23.0}},"35-39":{A:{mean:27.0,sd:11.8},B:{mean:61.5,sd:25.0}},
  "40-44":{A:{mean:28.6,sd:12.5},B:{mean:67.0,sd:27.5}},"45-49":{A:{mean:30.5,sd:13.5},B:{mean:73.0,sd:30.0}},
  "50-54":{A:{mean:33.0,sd:15.0},B:{mean:82.0,sd:34.0}},"55-59":{A:{mean:36.5,sd:16.5},B:{mean:93.0,sd:38.0}},
  "60-64":{A:{mean:41.0,sd:18.5},B:{mean:108.0,sd:44.0}},"65-69":{A:{mean:46.0,sd:21.0},B:{mean:127.0,sd:52.0}},
  "70-74":{A:{mean:53.0,sd:24.0},B:{mean:152.0,sd:63.0}},"75-79":{A:{mean:63.0,sd:29.0},B:{mean:189.0,sd:80.0}},
  "80-89":{A:{mean:79.0,sd:38.0},B:{mean:245.0,sd:110.0}},
};

function getTMTAgeGroup(age){const groups=["18-24","25-29","30-34","35-39","40-44","45-49","50-54","55-59","60-64","65-69","70-74","75-79","80-89"];for(const g of groups){const parts=g.split("-").map(Number);if(age>=parts[0]&&age<=parts[1])return g;}return null;}

const FV_NORMS_ALLEGRI={
  "<45":{Primaria:{sem:{mean:16.5,sd:2.8},fon:{mean:12.8,sd:3.9}},Secundaria:{sem:{mean:20.9,sd:5.6},fon:{mean:16.3,sd:6.1}},Terciaria:{sem:{mean:23.8,sd:6.2},fon:{mean:18.1,sd:6.2}}},
  "46-55":{Primaria:{sem:{mean:18.7,sd:3.0},fon:{mean:14.8,sd:2.6}},Secundaria:{sem:{mean:22.4,sd:4.7},fon:{mean:19.0,sd:4.7}},Terciaria:{sem:{mean:22.4,sd:4.8},fon:{mean:17.1,sd:4.1}}},
  "56-65":{Primaria:{sem:{mean:15.5,sd:3.7},fon:{mean:13.3,sd:5.7}},Secundaria:{sem:{mean:19.2,sd:5.2},fon:{mean:15.2,sd:4.0}},Terciaria:{sem:{mean:21.6,sd:5.4},fon:{mean:16.6,sd:3.2}}},
  "66-75":{Primaria:{sem:{mean:15.4,sd:3.9},fon:{mean:10.8,sd:3.1}},Secundaria:{sem:{mean:19.3,sd:5.1},fon:{mean:14.5,sd:3.5}},Terciaria:{sem:{mean:19.5,sd:5.5},fon:{mean:16.4,sd:4.5}}},
  ">75":{Primaria:{sem:{mean:12.4,sd:2.9},fon:{mean:9.8,sd:4.7}},Secundaria:{sem:{mean:16.5,sd:2.3},fon:{mean:14.0,sd:3.7}},Terciaria:{sem:{mean:15.1,sd:3.5},fon:{mean:9.8,sd:4.7}}},
};

const FV_NORMS_FERNANDEZ={
  M:{Primaria:{mean:17.30,sd:4.37},Secundaria:{mean:20.22,sd:5.56},Terciaria:{mean:23.15,sd:4.97}},
  F:{Primaria:{mean:16.19,sd:3.53},Secundaria:{mean:18.67,sd:5.30},Terciaria:{mean:21.46,sd:4.12}},
};

function getFVAgeGroup(age){if(age<45)return"<45";if(age<=55)return"46-55";if(age<=65)return"56-65";if(age<=75)return"66-75";return">75";}
function getEdLevelFV(education){if(!education)return null;const e=education.toLowerCase();if(e.includes("primario"))return"Primaria";if(e.includes("secundario"))return"Secundaria";return"Terciaria";}

const REY_COPIA_PC=[{pc:99,s:36},{pc:90,s:35},{pc:80,s:34},{pc:75,s:33},{pc:70,s:32},{pc:60,s:31},{pc:50,s:30},{pc:40,s:29},{pc:30,s:28},{pc:25,s:27},{pc:20,s:26},{pc:10,s:25},{pc:1,s:22}];
const REY_MEMORIA_PC=[{pc:99,s:32},{pc:90,s:28},{pc:80,s:25},{pc:75,s:24},{pc:70,s:23},{pc:60,s:22},{pc:50,s:21},{pc:40,s:20},{pc:30,s:18},{pc:25,s:17},{pc:20,s:16},{pc:10,s:15},{pc:1,s:10}];
function reyScoreToPc(score,table){for(const row of table){if(score>=row.s)return row.pc;}return 1;}

const MBI_ITEMS=[
  {num:1,sub:"AE",text:"Me siento emocionalmente defraudado/a en mi trabajo."},{num:2,sub:"AE",text:"Cuando termino mi jornada de trabajo me siento agotado/a."},{num:3,sub:"AE",text:"Cuando me levanto por la mañana y me enfrento a otra jornada de trabajo me siento agotado/a."},{num:4,sub:"RP",text:"Siento que puedo entender fácilmente a las personas que tengo que atender."},{num:5,sub:"D",text:"Siento que estoy tratando a algunos pacientes/beneficiarios como si fuesen objetos impersonales."},{num:6,sub:"AE",text:"Siento que trabajar todo el día con la gente me cansa."},{num:7,sub:"RP",text:"Siento que trato con mucha efectividad los problemas de las personas que atiendo."},{num:8,sub:"AE",text:"Siento que mi trabajo me está desgastando."},{num:9,sub:"RP",text:"Siento que estoy influyendo positivamente en las vidas de otras personas a través de mi trabajo."},{num:10,sub:"D",text:"Siento que me he hecho más duro/a con la gente."},{num:11,sub:"D",text:"Me preocupa que este trabajo me está endureciendo emocionalmente."},{num:12,sub:"RP",text:"Me siento muy enérgico/a en mi trabajo."},{num:13,sub:"AE",text:"Me siento frustrado/a por el trabajo."},{num:14,sub:"AE",text:"Siento que estoy demasiado tiempo en mi trabajo."},{num:15,sub:"D",text:"Siento que realmente no me importa lo que les ocurra a las personas que atiendo profesionalmente."},{num:16,sub:"AE",text:"Siento que trabajar en contacto directo con la gente me cansa."},{num:17,sub:"RP",text:"Siento que puedo crear con facilidad un clima agradable en mi trabajo."},{num:18,sub:"RP",text:"Me siento estimulado/a después de haber trabajado estrechamente con quienes atiendo."},{num:19,sub:"RP",text:"Creo que consigo muchas cosas valiosas en este trabajo."},{num:20,sub:"AE",text:"Me siento como si estuviera al límite de mis posibilidades."},{num:21,sub:"RP",text:"Siento que en mi trabajo los problemas emocionales son tratados de forma adecuada."},{num:22,sub:"D",text:"Me parece que los beneficiarios de mi trabajo me culpan de algunos de sus problemas."},
];
const MBI_SCALE=["Nunca","Pocas veces al año","Una vez al mes","Pocas veces al mes","Una vez a la semana","Pocas veces a la semana","Todos los días"];
const MBI_CUTOFFS={AE:{low:16,high:27,max:54},D:{low:6,high:13,max:30},RP:{low:31,high:39,max:48}};
function classifyMBI(scale,score){const{low,high}=MBI_CUTOFFS[scale];if(scale==="RP"){if(score<=low)return{level:"Bajo",color:C.danger,burnout:true,desc:"Baja realización personal."};if(score<=high)return{level:"Medio",color:C.warning,burnout:false,desc:"Realización personal moderada."};return{level:"Alto",color:C.success,burnout:false,desc:"Alta realización personal."};}if(score<=low)return{level:"Bajo",color:C.success,burnout:false,desc:scale==="AE"?"Bajo agotamiento emocional.":"Baja despersonalización."};if(score<high)return{level:"Medio",color:C.warning,burnout:false,desc:scale==="AE"?"Agotamiento emocional moderado.":"Despersonalización moderada."};return{level:"Alto",color:C.danger,burnout:true,desc:scale==="AE"?"Alto agotamiento emocional.":"Alta despersonalización."};}

const SNAP_ITEMS=[
  {num:1,sub:"DA",text:"A menudo le cuesta prestar atención a detalles o comete errores por descuido."},{num:2,sub:"DA",text:"A menudo tiene dificultades en mantener la atención en tareas."},{num:3,sub:"DA",text:"A menudo parece no escuchar cuando se le habla directamente."},{num:4,sub:"DA",text:"A menudo no sigue instrucciones y no finaliza tareas."},{num:5,sub:"DA",text:"A menudo tiene dificultad en organizar sus tareas y actividades."},{num:6,sub:"DA",text:"A menudo evita tareas que requieren un esfuerzo mental sostenido."},{num:7,sub:"DA",text:"A menudo extravía objetos necesarios para realizar sus actividades."},{num:8,sub:"DA",text:"A menudo se distrae por estímulos irrelevantes."},{num:9,sub:"DA",text:"A menudo es descuidado/a en sus actividades diarias."},{num:10,sub:"GEN",text:"A menudo le cuesta mantenerse alerta o ejecutar consignas. [general]"},{num:11,sub:"HI",text:"A menudo mueve las manos y pies o se retuerce en el asiento."},{num:12,sub:"HI",text:"A menudo abandona su asiento en la clase."},{num:13,sub:"HI",text:"A menudo corre o salta excesivamente en situaciones inapropiadas."},{num:14,sub:"HI",text:"A menudo tiene dificultades para jugar tranquilamente."},{num:15,sub:"HI",text:'A menudo está "en marcha" o actúa como si tuviera un motor encendido.'},{num:16,sub:"HI",text:"A menudo habla en exceso."},{num:17,sub:"HI",text:"A menudo precipita respuestas antes de completarse las preguntas."},{num:18,sub:"HI",text:"A menudo tiene dificultades para guardar turno."},{num:19,sub:"HI",text:"A menudo interrumpe o se inmiscuye en actividades de otros."},{num:20,sub:"GEN",text:"A menudo tiene dificultad en permanecer quieto/a o inhibir impulsos. [general]"},{num:21,sub:"ODD",text:"A menudo se encoleriza e incurre en pataletas."},{num:22,sub:"ODD",text:"A menudo discute con adultos."},{num:23,sub:"ODD",text:"A menudo desafía a los adultos o se rehúsa a cumplir reglas."},{num:24,sub:"ODD",text:"A menudo molesta deliberadamente a otras personas."},{num:25,sub:"ODD",text:"A menudo acusa a otros de sus errores."},{num:26,sub:"ODD",text:"A menudo es susceptible o fácilmente se siente molestado/a."},{num:27,sub:"ODD",text:"A menudo es colérico/a y resentido/a."},{num:28,sub:"ODD",text:"A menudo es rencoroso/a y vengativo/a."},
];
const SNAP_CUTOFFS={DA:{sumCut:15,indexCut:1.66,sens:72.7,spec:65.3},HI:{sumCut:16,indexCut:1.77,sens:86.4,spec:73.5}};

// ══════════════════════════════════════════════════════════════════════════════
// ─── STROOP FORM & RESULTS ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function computeStroop(data,age,education){
  const a=parseInt(age)||0;
  // ── Galaverna (primario): Z-scores por edad × escolaridad ──
  const galAg=getStroopGalavernaAgeGroup(a);
  const galEd=getStroopEdLevel(education);
  const galNorm=(galAg&&galEd)?{
    P:STROOP_GALAVERNA.P[galEd][galAg],
    C:STROOP_GALAVERNA.C[galEd][galAg],
    PC:STROOP_GALAVERNA.PC[galEd][galAg],
    Interf:STROOP_GALAVERNA.Interf[galEd][galAg],
  }:null;
  const rawP=data.P!==""&&data.P!==undefined?parseInt(data.P):null;
  const rawC=data.C!==""&&data.C!==undefined?parseInt(data.C):null;
  const rawPC=data.PC!==""&&data.PC!==undefined?parseInt(data.PC):null;
  // Galaverna Z-scores
  const zP=rawP!==null&&galNorm?zScore(rawP,galNorm.P.m,galNorm.P.s):null;
  const zC=rawC!==null&&galNorm?zScore(rawC,galNorm.C.m,galNorm.C.s):null;
  const zPC=rawPC!==null&&galNorm?zScore(rawPC,galNorm.PC.m,galNorm.PC.s):null;
  // Interferencia raw y su Z
  let interference=null,zInterf=null;
  if(rawP&&rawC&&rawPC){
    const pcPrime=(rawP*rawC)/(rawP+rawC);
    interference=parseFloat((rawPC-pcPrime).toFixed(2));
    if(galNorm) zInterf=zScore(interference,galNorm.Interf.m,galNorm.Interf.s);
  }
  // ── Golden (secundario): T-scores con corrección por edad ──
  const corr=getStroopAgeCorr(a);
  const corrP=rawP!==null?rawP+corr.P:null;
  const corrC=rawC!==null?rawC+corr.C:null;
  const corrPC=rawPC!==null?rawPC+corr.PC:null;
  const tP=corrP!==null?rawToTStroop(corrP,1):null;
  const tC=corrC!==null?rawToTStroop(corrC,2):null;
  const tPC=corrPC!==null?rawToTStroop(corrPC,3):null;
  let tInterf=null;
  if(interference!==null) tInterf=interferenceTStroop(interference);
  return {
    rawP,rawC,rawPC,interference,
    // Galaverna
    galAg,galEd,galNorm,zP,zC,zPC,zInterf,
    // Golden
    corrP,corrC,corrPC,tP,tC,tPC,tInterf,corr,
    ageGroup:a<45?"16-44":a<65?"45-64":"65-80",
  };
}

function StroopForm({stroopData,setStroopData,patient}){
  const up=(k,v)=>setStroopData(d=>({...d,[k]:v}));
  const age=parseInt(patient.age)||0;
  const partial=computeStroop(stroopData,age,patient.education);
  const galOk=!!(partial.galAg&&partial.galEd);

  const laminaZKey={P:"zP",C:"zC",PC:"zPC"};
  const laminaColors={P:C.primary,C:C.dark,PC:"#6d28d9"};
  const laminaDescs={
    P:"Leer palabras (ROJO/VERDE/AZUL) en tinta negra — velocidad lectora.",
    C:"Nombrar el color de XXXX (rojo/verde/azul) — velocidad de nombramiento.",
    PC:"Nombrar el color de la tinta ignorando la palabra escrita — control inhibitorio / FE.",
  };
  const laminaLabels={P:"Palabras",C:"Colores",PC:"Color-Palabra"};

  return(
    <div style={S.card}>
      <h3 style={S.sectionTitle}>🎨 Stroop — Test de Colores y Palabras</h3>
      <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Galaverna y cols. (2014) — baremos argentinos por edad × escolaridad (fuente primaria). Golden (1994) como referencia secundaria.</p>

      {galOk?(
        <div style={{background:`${C.success}12`,border:`1px solid ${C.success}50`,borderRadius:8,padding:"10px 16px",marginBottom:16}}>
          <span style={{fontFamily:font,fontSize:13,fontWeight:700,color:C.success}}>✓ Baremo Galaverna activo · </span>
          <span style={{fontFamily:font,fontSize:13,color:C.textDark}}>Grupo: {partial.galAg} años · Escolaridad {partial.galEd}</span>
        </div>
      ):(
        <div style={{background:`${C.warning}12`,border:`1px solid ${C.warning}50`,borderRadius:8,padding:"10px 16px",marginBottom:16}}>
          <span style={{fontFamily:font,fontSize:13,color:C.warning}}>⚠ Ingresá edad y nivel educativo del paciente para aplicar baremos de Galaverna. Se mostrará solo T-score Golden.</span>
        </div>
      )}

      <div style={S.grid3}>
        {["P","C","PC"].map(id=>{
          const zVal=partial[laminaZKey[id]];
          const cls=zVal!==null?classifyZ(zVal):null;
          const norm=partial.galNorm?partial.galNorm[id]:null;
          return(
            <div key={id} style={{border:`2px solid ${cls?cls.color+"60":C.border}`,borderRadius:12,padding:20,background:cls?`${cls.color}05`:"#fff"}}>
              <div style={{background:laminaColors[id],color:"white",borderRadius:8,padding:"8px 16px",marginBottom:12,fontWeight:700,fontFamily:font,fontSize:15}}>{id} — {laminaLabels[id]}</div>
              <p style={{margin:"0 0 12px",fontSize:12,color:C.textLight,fontFamily:font}}>{laminaDescs[id]}</p>
              <div style={S.formGroup}>
                <label style={S.label}>N° estímulos correctos (45 seg)</label>
                <input type="number" min={0} max={200} style={S.input} value={stroopData[id]||""} onChange={e=>up(id,e.target.value)} placeholder="Ej: 95"/>
              </div>
              {norm&&stroopData[id]&&(
                <p style={{margin:"0 0 8px",fontSize:11,color:C.textLight,fontFamily:font}}>Norma Galaverna: M={norm.m} · DE={norm.s}</p>
              )}
              {zVal!==null&&cls&&(
                <div style={{background:`${cls?cls.color:"transparent"}15`,borderRadius:8,padding:"10px 14px",marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontFamily:font,fontWeight:700,color:cls?cls.color:C.textLight}}>Z = {zVal>0?"+":""}{zVal}</span>
                    <span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span>
                  </div>
                </div>
              )}
              {partial["t"+id]&&(
                <div style={{fontSize:11,color:C.textLight,fontFamily:font}}>Golden T = {partial["t"+id]} · {classifyT(partial["t"+id]).label}</div>
              )}
            </div>
          );
        })}
      </div>

      {partial.interference!==null&&(
        <div style={{background:`${C.primary}08`,border:`1px solid ${C.border}`,borderRadius:10,padding:"16px 20px",marginTop:12}}>
          <div style={{display:"flex",gap:24,alignItems:"center",flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font,marginBottom:4}}>PC' ESTIMADA</div>
              <div style={{fontSize:20,fontWeight:800,fontFamily:font,color:C.textMid}}>{((partial.rawP*partial.rawC)/(partial.rawP+partial.rawC)).toFixed(1)}</div>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font,marginBottom:4}}>INTERFERENCIA (PC − PC')</div>
              <div style={{fontSize:26,fontWeight:800,fontFamily:font,color:partial.interference>=0?C.success:C.danger}}>{partial.interference>0?"+":""}{partial.interference}</div>
            </div>
            {partial.zInterf!==null&&(
              <div>
                <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font,marginBottom:4}}>Z INTERFERENCIA</div>
                <div style={{fontSize:26,fontWeight:800,fontFamily:font,color:classifyZ(partial.zInterf).color}}>{partial.zInterf>0?"+":""}{partial.zInterf}</div>
              </div>
            )}
            {partial.tInterf&&(
              <div>
                <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font,marginBottom:4}}>T INTERFERENCIA (Golden)</div>
                <div style={{fontSize:20,fontWeight:700,fontFamily:font,color:classifyT(partial.tInterf).color}}>{partial.tInterf}</div>
              </div>
            )}
            {partial.zInterf!==null&&(
              <div style={{marginLeft:"auto"}}><span style={S.badge(classifyZ(partial.zInterf).color)}>{classifyZ(partial.zInterf).label}</span></div>
            )}
          </div>
        </div>
      )}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
        <ClearBtn onClear={()=>{setStroopData({})}}/>
      </div>
    </div>

  );
}

function StroopResults({r}){
  const galOk=!!(r.galAg&&r.galEd);
  const laminaData=[
    {key:"P",label:"Palabras (P)",raw:r.rawP,z:r.zP,t:r.tP,norm:r.galNorm?.P,desc:"Velocidad lectora"},
    {key:"C",label:"Colores (C)",raw:r.rawC,z:r.zC,t:r.tC,norm:r.galNorm?.C,desc:"Velocidad nombramiento"},
    {key:"PC",label:"Color-Palabra (PC)",raw:r.rawPC,z:r.zPC,t:r.tPC,norm:r.galNorm?.PC,desc:"Control inhibitorio / FE"},
    {key:"Interf",label:"Interferencia",raw:r.interference,z:r.zInterf,t:r.tInterf,norm:r.galNorm?.Interf,desc:"Resistencia a interferencia"},
  ];
  return(
    <div style={S.card}>
      <h3 style={S.sectionTitle}>🎨 Stroop
        <span style={{fontSize:13,fontWeight:400,color:C.textLight}}>
          {galOk?` Galaverna (2014) · ${r.galAg} años · Escolaridad ${r.galEd}`:" Golden (1994)"}
        </span>
      </h3>
      <div style={S.grid4}>
        {laminaData.map(item=>{
          const cls=item.z!==null?classifyZ(item.z):classifyT(item.t);
          const mainScore=item.z!==null?(item.z>0?"+":"")+item.z:item.raw;
          const mainLabel=item.z!==null?"Z":"Raw";
          return(
            <div key={item.key} style={{...S.indexBox,border:`2px solid ${cls?cls.color+"30":C.border}`}}>
              <div style={{fontSize:11,fontWeight:700,fontFamily:font,color:C.textLight,marginBottom:6}}>{item.label}</div>
              <div style={{fontSize:13,fontWeight:700,fontFamily:font,color:C.textLight,marginBottom:4}}>Raw: {item.raw??"—"}</div>
              {item.z!==null&&(
                <div style={{fontSize:32,fontWeight:800,fontFamily:font,color:cls?cls.color:C.textLight}}>{mainScore}</div>
              )}
              {item.z!==null&&<div style={{fontSize:11,fontFamily:font,color:C.textLight}}>Z-score</div>}
              {item.norm&&<div style={{fontSize:10,color:C.textLight,fontFamily:font,marginTop:2}}>M={item.norm.m} DE={item.norm.s}</div>}
              {item.t&&<div style={{fontSize:12,fontFamily:font,color:C.textLight,marginTop:4}}>Golden T={item.t}</div>}
              <div style={{marginTop:8}}><span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span></div>
              <div style={{fontSize:11,color:C.textLight,fontFamily:font,marginTop:4}}>{item.desc}</div>
              {item.z!==null&&(
                <div style={{height:8,background:C.border,borderRadius:4,marginTop:8,overflow:"hidden"}}>
                  <div style={{width:`${Math.min(Math.max(((item.z+3)/6)*100,0),100)}%`,height:"100%",background:cls?cls.color:C.textLight,borderRadius:4}}/>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!galOk&&(
        <div style={{background:`${C.warning}12`,border:`1px solid ${C.warning}40`,borderRadius:8,padding:"10px 14px",marginTop:12}}>
          <p style={{margin:0,fontSize:12,fontFamily:font,color:C.warning}}>⚠ Sin baremos Galaverna — completá edad y escolaridad del paciente para obtener Z-scores normativos argentinos.</p>
        </div>
      )}
      <div style={{background:`${C.primary}08`,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 18px",marginTop:14}}>
        <p style={{margin:"0 0 6px",fontWeight:700,fontFamily:font,fontSize:14,color:C.primary}}>Interpretación clínica:</p>
        <p style={{margin:"0 0 4px",fontSize:13,fontFamily:font,color:C.textDark}}>• <strong>Lámina P:</strong> velocidad de lectura — sensible a dislexia y Alzheimer.</p>
        <p style={{margin:"0 0 4px",fontSize:13,fontFamily:font,color:C.textDark}}>• <strong>Lámina C:</strong> velocidad de nombramiento de colores — perturbaciones del lenguaje nominativo.</p>
        <p style={{margin:"0 0 4px",fontSize:13,fontFamily:font,color:C.textDark}}>• <strong>Lámina PC:</strong> inhibición de respuesta automática — corteza prefrontal dorsolateral y cingular anterior.</p>
        <p style={{margin:"0 0 4px",fontSize:13,fontFamily:font,color:C.textDark}}>• <strong>Interferencia:</strong> PC − PC' (esperado). Valor negativo = rendimiento por debajo de lo esperado.</p>
        <p style={{margin:0,fontSize:12,fontFamily:font,color:C.textLight}}>Fuente primaria: Galaverna y cols. (2014) — muestra argentina. Secundaria: Golden (1994) / TEA Ediciones.</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── RAVLT FORM & RESULTS ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function RAVLTScoreInput({label,k,norm,inverted,note,value,onUpdate,adultGroup}){
  const n=norm?RAVLT_ADULT_NORMS[adultGroup]?.[k]||norm:null;
  const z=n&&value!==undefined&&value!==""?zScore(parseInt(value),n.m,n.s):null;
  const cls=z!==null?classifyZ(z,inverted||false):null;
  return(
    <div style={{border:`1px solid ${C.border}`,borderRadius:8,padding:12}}>
      <label style={{...S.label,marginBottom:4}}>{label}</label>
      {note&&<p style={{margin:"0 0 6px",fontSize:11,color:C.textLight,fontFamily:font}}>{note}</p>}
      <input type="number" min={0} max={15} style={S.input} value={value||""} onChange={e=>onUpdate(k,e.target.value)} placeholder="0-15"/>
      {n&&<p style={{margin:"4px 0 0",fontSize:11,color:C.textLight,fontFamily:font}}>M={n.m} DS={n.s}</p>}
      {z!==null&&<div style={{marginTop:6,display:"flex",gap:8,alignItems:"center"}}><span style={{fontFamily:font,fontWeight:700,fontSize:13,color:cls?cls.color:C.textLight}}>Z={z>0?"+":""}{z}</span><span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span></div>}
    </div>
  );
}

function RAVLTBarRow({label,val,norm,inverted}){
  if(!val&&val!==0)return null;
  const z=norm?zScore(val,norm.m,norm.s):null;
  const cls=z!==null?classifyZ(z,inverted||false):{label:"—",color:C.textLight};
  const pct=(val/15)*100;
  return(
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
      <span style={{fontFamily:font,fontWeight:700,fontSize:13,minWidth:120,color:C.textMid}}>{label}</span>
      <span style={{fontFamily:font,fontWeight:800,fontSize:16,minWidth:30,color:cls?cls.color:C.textLight}}>{val}</span>
      {z!==null&&<span style={{fontFamily:font,fontSize:12,color:C.textLight}}>Z={z>0?"+":""}{z}</span>}
      <div style={{flex:1,height:8,background:C.border,borderRadius:4,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:cls?cls.color:C.textLight,borderRadius:4}}/></div>
      <span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span>
    </div>
  );
}

function RAVLTForm({ravltData,setRavltData,patient}){
  const up=(k,v)=>setRavltData(d=>({...d,[k]:v}));
  const age=parseInt(patient.age)||0;
  const isChild=age>=5&&age<=14;
  const isAdult=age>=16;
  const adultGroup=getRavltAdultGroup(age);
  const childNorm=isChild?RAVLT_CHILD_NORMS[age]:null;
  const adultNorm=adultGroup?RAVLT_ADULT_NORMS[adultGroup]:null;

  const adultTrials=["A1","A2","A3","A4","A5","B1","A6","A7"];
  const childTrials=["I","II","III","IV","V","D"];

  // ScoreInput moved to module level as RAVLTScoreInput

  return(
    <div style={S.card}>
      <h3 style={S.sectionTitle}>📝 RAVLT — Test de Aprendizaje Verbal de Rey</h3>
      <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Rey (1964/1994). Baremos: protocolo_con_baremos.pdf — Adaptación argentina.</p>
      {!isChild&&!isAdult&&<p style={{fontFamily:font,fontSize:13,color:C.danger,margin:"0 0 16px"}}>⚠ La edad ingresada ({age}) está fuera del rango normativo (5-14 años o 16-70+). Completá la edad del paciente.</p>}
      {adultGroup&&<div style={{background:`${C.accent}10`,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 16px",marginBottom:16}}><span style={{fontFamily:font,fontSize:13,fontWeight:700,color:C.primary}}>Adultos — Grupo: {adultGroup} años (n≈10-13)</span></div>}
      {isChild&&childNorm&&<div style={{background:`${C.accent}10`,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 16px",marginBottom:16}}><span style={{fontFamily:font,fontSize:13,fontWeight:700,color:C.primary}}>Niños — Edad: {age} años · Lista I (M={childNorm.I.m}±{childNorm.I.s}) · Lista V (M={childNorm.V.m}±{childNorm.V.s}) · D (M={childNorm.D.m}±{childNorm.D.s})</span></div>}

      {isAdult&&adultNorm&&(
        <>
          <div style={{background:C.primary,color:"white",padding:"8px 16px",borderRadius:"8px 8px 0 0",fontWeight:700,fontFamily:font,marginBottom:0,fontSize:14}}>ENSAYOS DE APRENDIZAJE — Lista A (15 palabras)</div>
          <div style={{border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 8px 8px",padding:16,marginBottom:16}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
              {["A1","A2","A3","A4","A5"].map(k=><RAVLTScoreInput key={k} label={k} k={k} norm={adultNorm[k]} value={ravltData[k]} onUpdate={up} adultGroup={adultGroup}/>)}
            </div>
          </div>
          <div style={{background:C.dark,color:"white",padding:"8px 16px",borderRadius:"8px 8px 0 0",fontWeight:700,fontFamily:font,fontSize:14}}>INTERFERENCIA Y RETENCIÓN</div>
          <div style={{border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 8px 8px",padding:16,marginBottom:16}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
              <RAVLTScoreInput label="B1 — Lista interferente" k="B1" norm={adultNorm.B1} note="Recuerdo de lista B tras presentación" value={ravltData.B1} onUpdate={up} adultGroup={adultGroup}/>
              <RAVLTScoreInput label="A6 — Recuerdo post-B" k="A6" norm={adultNorm.A6} note="Lista A inmediata tras B1" value={ravltData.A6} onUpdate={up} adultGroup={adultGroup}/>
              <RAVLTScoreInput label="A7 — Recuerdo demorado 20'" k="A7" norm={adultNorm.A7} note="Recuerdo libre a los 20 minutos" value={ravltData.A7} onUpdate={up} adultGroup={adultGroup}/>
            </div>
          </div>
          <div style={{...S.grid2,marginBottom:16}}>
            <div style={S.formGroup}>
              <label style={S.label}>Total intrusiones (sesión)</label>
              <input type="number" min={0} style={S.input} value={ravltData.intrusiones||""} onChange={e=>up("intrusiones",e.target.value)} placeholder="N° intrusiones"/>
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Total repeticiones (sesión)</label>
              <input type="number" min={0} style={S.input} value={ravltData.repeticiones||""} onChange={e=>up("repeticiones",e.target.value)} placeholder="N° repeticiones"/>
            </div>
          </div>
        </>
      )}

      {isChild&&(
        <>
          <div style={{background:C.primary,color:"white",padding:"8px 16px",borderRadius:"8px 8px 0 0",fontWeight:700,fontFamily:font,fontSize:14}}>ENSAYOS (Niños 5-14 años)</div>
          <div style={{border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 8px 8px",padding:16,marginBottom:16}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10}}>
              {["I","II","III","IV","V"].map(k=>{
                const hasNorm=k==="I"?childNorm?.I:k==="V"?childNorm?.V:null;
                const z=hasNorm&&ravltData[k]!==undefined&&ravltData[k]!==""?zScore(parseInt(ravltData[k]),hasNorm.m,hasNorm.s):null;
                const cls=classifyZ(z);
                return(
                  <div key={k} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:10}}>
                    <label style={{...S.label,marginBottom:4}}>Lista {k}</label>
                    <input type="number" min={0} max={15} style={S.input} value={ravltData[k]||""} onChange={e=>up(k,e.target.value)} placeholder="0-15"/>
                    {hasNorm&&<p style={{margin:"4px 0 0",fontSize:11,color:C.textLight,fontFamily:font}}>M={hasNorm.m} DS={hasNorm.s}</p>}
                    {z!==null&&<span style={{...S.badge(cls?cls.color:C.textLight),marginTop:4,display:"inline-block"}}>Z={z>0?"+":""}{z}</span>}
                  </div>
                );
              })}
              <div style={{border:`1px solid ${C.border}`,borderRadius:8,padding:10}}>
                <label style={{...S.label,marginBottom:4}}>D (30 min)</label>
                <input type="number" min={0} max={15} style={S.input} value={ravltData["D"]||""} onChange={e=>up("D",e.target.value)} placeholder="0-15"/>
                {childNorm?.D&&<p style={{margin:"4px 0 0",fontSize:11,color:C.textLight,fontFamily:font}}>M={childNorm.D.m} DS={childNorm.D.s}</p>}
                {childNorm?.D&&ravltData["D"]!==""&&ravltData["D"]!==undefined&&zScore(parseInt(ravltData["D"]),childNorm.D.m,childNorm.D.s)!==null&&
                  <span style={{...S.badge(classifyZ(zScore(parseInt(ravltData["D"]),childNorm.D.m,childNorm.D.s)).color),marginTop:4,display:"inline-block"}}>Z={zScore(parseInt(ravltData["D"]),childNorm.D.m,childNorm.D.s)>0?"+":""}{zScore(parseInt(ravltData["D"]),childNorm.D.m,childNorm.D.s)}</span>
                }
              </div>
            </div>
          </div>
          <div style={{...S.grid2}}>
            <div style={S.formGroup}><label style={S.label}>Intrusiones</label><input type="number" min={0} style={S.input} value={ravltData.intrusiones||""} onChange={e=>up("intrusiones",e.target.value)} placeholder="0"/></div>
            <div style={S.formGroup}><label style={S.label}>Repeticiones</label><input type="number" min={0} style={S.input} value={ravltData.repeticiones||""} onChange={e=>up("repeticiones",e.target.value)} placeholder="0"/></div>
          </div>
        </>
      )}

      <div style={{background:`${C.primary}08`,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 18px"}}>
        <p style={{margin:"0 0 4px",fontWeight:700,fontFamily:font,fontSize:13,color:C.primary}}>Interpretación clínica del RAVLT:</p>
        <p style={{margin:0,fontSize:12,fontFamily:font,color:C.textDark}}>La curva A1→A5 refleja la tasa de aprendizaje (lóbulo temporal medial izquierdo). B1 evalúa interferencia proactiva. A5–A6 cuantifica la pérdida por interferencia retroactiva. A7 (20') evalúa consolidación. Intrusiones sugieren disfunción prefrontal o confabulación.</p>
      </div>
    </div>
  );
}

function RAVLTResults({r}){
  const {age,adultGroup,adultNorm,isAdult,isChild,childNorm} = r;
  const trials=isAdult?["A1","A2","A3","A4","A5"]:["I","II","III","IV","V"];
  const values=trials.map(k=>parseInt(r.scores[k])||0);
  const maxVal=15;

  // Learning slope (A1→A5 linear regression)
  let slope=null;
  if(isAdult&&r.scores.A1&&r.scores.A5){
    const xs=[1,2,3,4,5],ys=["A1","A2","A3","A4","A5"].map(k=>parseInt(r.scores[k])||0);
    const n=xs.length,sumX=xs.reduce((a,b)=>a+b,0),sumY=ys.reduce((a,b)=>a+b,0);
    const sumXY=xs.reduce((s,x,i)=>s+x*ys[i],0),sumX2=xs.reduce((s,x)=>s+x*x,0);
    slope=parseFloat(((n*sumXY-sumX*sumY)/(n*sumX2-sumX*sumX)).toFixed(2));
  }

  // BarRow moved to module level as RAVLTBarRow

  return(
    <div style={S.card}>
      <h3 style={S.sectionTitle}>📝 RAVLT <span style={{fontSize:13,fontWeight:400,color:C.textLight}}>{isAdult?`Adultos · Grupo ${adultGroup}`:`Niños · ${age} años`}</span></h3>
      {slope!==null&&(
        <div style={{...S.indexBox,textAlign:"left",marginBottom:16,display:"flex",gap:32,alignItems:"center"}}>
          <div><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>PENDIENTE A1→A5</div><div style={{fontSize:28,fontWeight:800,fontFamily:font,color:slope>=1.5?C.success:slope>=0.5?C.warning:C.danger}}>+{slope}</div><div style={{fontSize:11,color:C.textLight,fontFamily:font}}>palabras/ensayo</div></div>
          <div style={{fontSize:12,fontFamily:font,color:C.textDark}}>{slope>=1.5?"Curva de aprendizaje adecuada":slope>=0.5?"Curva de aprendizaje lenta — posible dificultad de codificación":"Curva plana — alteración significativa del aprendizaje verbal"}</div>
        </div>
      )}
      {isAdult&&adultNorm&&(
        <div style={{marginBottom:16}}>
          {["A1","A2","A3","A4","A5"].map(k=><RAVLTBarRow key={k} label={`Ensayo ${k}`} val={parseInt(r.scores[k])} norm={adultNorm[k]}/>)}
          <div style={{height:1,background:C.border,margin:"12px 0"}}/>
          <RAVLTBarRow label="B1 (Interferencia)" val={parseInt(r.scores.B1)} norm={adultNorm.B1}/>
          <RAVLTBarRow label="A6 (Post-B)" val={parseInt(r.scores.A6)} norm={adultNorm.A6}/>
          <RAVLTBarRow label="A7 (20 min)" val={parseInt(r.scores.A7)} norm={adultNorm.A7}/>
        </div>
      )}
      {isChild&&childNorm&&(
        <div style={{marginBottom:16}}>
          <RAVLTBarRow label="Lista I (1° ensayo)" val={parseInt(r.scores.I)} norm={childNorm.I}/>
          <RAVLTBarRow label="Lista V (5° ensayo)" val={parseInt(r.scores.V)} norm={childNorm.V}/>
          <RAVLTBarRow label="D (30 min)" val={parseInt(r.scores.D)} norm={childNorm.D}/>
        </div>
      )}
      {(r.scores.intrusiones||r.scores.repeticiones)&&(
        <div style={{display:"flex",gap:24,marginBottom:12}}>
          {r.scores.intrusiones&&<div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>INTRUSIONES</div><div style={{fontSize:28,fontWeight:800,fontFamily:font,color:parseInt(r.scores.intrusiones)>2?C.warning:C.success}}>{r.scores.intrusiones}</div></div>}
          {r.scores.repeticiones&&<div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>REPETICIONES</div><div style={{fontSize:28,fontWeight:800,fontFamily:font,color:C.textDark}}>{r.scores.repeticiones}</div></div>}
          {isAdult&&r.scores.A5&&r.scores.A6&&<div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>PÉRDIDA A5→A6</div><div style={{fontSize:28,fontWeight:800,fontFamily:font,color:(parseInt(r.scores.A5)-parseInt(r.scores.A6))>3?C.danger:C.success}}>{parseInt(r.scores.A5)-parseInt(r.scores.A6)}</div><div style={{fontSize:11,color:C.textLight,fontFamily:font}}>interferencia retroactiva</div></div>}
        </div>
      )}
      <div style={{background:`${C.primary}08`,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 18px"}}>
        <p style={{margin:"0 0 4px",fontWeight:700,fontFamily:font,fontSize:13,color:C.primary}}>Referencia:</p>
        <p style={{margin:0,fontSize:12,fontFamily:font,color:C.textDark}}>Rey (1964/1994). Test de Aprendizaje Verbal. Baremos: protocolo_con_baremos.pdf — Argentina. Z = (X – M) / DS · T = 10 × z + 50.</p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── TAVEC FORM & RESULTS ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function TAVECForm({tavecData,setTavecData,patient}){
  const up=(k,v)=>setTavecData(d=>({...d,[k]:v}));
  const age=parseInt(patient.age)||0;
  const ag=getTavecAgeGroup(age);
  const norm=ag?TAVEC_NORMS[ag]:null;

  return(
    <div style={S.card}>
      <h3 style={S.sectionTitle}>📚 TAVEC — Test de Aprendizaje Verbal España-Complutense</h3>
      <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Benedet & Alejandre (1998). TEA Ediciones, Madrid. Baremos españoles — 16 palabras en 4 categorías semánticas.</p>
      {!ag&&<p style={{fontFamily:font,fontSize:13,color:C.danger,margin:"0 0 12px"}}>⚠ Edad fuera del rango normativo (20-70 años). Completá la edad del paciente.</p>}
      {ag&&<div style={{background:`${C.accent}10`,border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 16px",marginBottom:16}}><span style={{fontFamily:font,fontSize:13,fontWeight:700,color:C.primary}}>Grupo: {ag} años</span><span style={{fontFamily:font,fontSize:12,color:C.textLight,marginLeft:10}}>Baremos de referencia disponibles</span></div>}

      {/* Learning trials */}
      <div style={{background:C.primary,color:"white",padding:"8px 16px",borderRadius:"8px 8px 0 0",fontWeight:700,fontFamily:font,fontSize:14}}>CURVA DE APRENDIZAJE — Lista A (5 ensayos, máx. 16 c/u)</div>
      <div style={{border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 8px 8px",padding:16,marginBottom:16}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
          {["A1","A2","A3","A4","A5"].map(k=>{
            const n=norm?.[k];
            const val=tavecData[k];
            const z=n&&val!==undefined&&val!==""?zScore(parseInt(val),n.m,n.s):null;
            const cls=classifyZ(z);
            return(
              <div key={k} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:10}}>
                <label style={{...S.label,marginBottom:4}}>Ensayo {k}</label>
                <input type="number" min={0} max={16} style={S.input} value={val||""} onChange={e=>up(k,e.target.value)} placeholder="0-16"/>
                {n&&<p style={{margin:"4px 0 0",fontSize:10,color:C.textLight,fontFamily:font}}>M={n.m} DS={n.s}</p>}
                {z!==null&&cls&&<div style={{marginTop:4}}><span style={{...S.badge(cls?cls.color:C.textLight),fontSize:10}}>{z>0?"+":""}{z}</span></div>}
              </div>
            );
          })}
        </div>
        <div style={{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          {[{k:"total",label:"Total A1-A5",max:80},{k:"B",label:"Lista B (Interferencia)",max:16}].map(({k,label,max})=>{
            const n=norm?.[k]; const val=tavecData[k];
            const z=n&&val!==""&&val!==undefined?zScore(parseInt(val),n.m,n.s):null;
            const cls=classifyZ(z);
            return(
              <div key={k} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:12}}>
                <label style={S.label}>{label} (máx. {max})</label>
                <input type="number" min={0} max={max} style={S.input} value={val||""} onChange={e=>up(k,e.target.value)} placeholder={`0-${max}`}/>
                {n&&<p style={{margin:"4px 0 0",fontSize:11,color:C.textLight,fontFamily:font}}>M={n.m} DS={n.s}</p>}
                {z!==null&&cls&&<div style={{marginTop:6,display:"flex",gap:8,alignItems:"center"}}><span style={{fontFamily:font,fontWeight:700,fontSize:13,color:cls?cls.color:C.textLight}}>Z={z>0?"+":""}{z}</span><span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span></div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Short term recall */}
      <div style={{background:C.dark,color:"white",padding:"8px 16px",borderRadius:"8px 8px 0 0",fontWeight:700,fontFamily:font,fontSize:14}}>RECUERDO A CORTO PLAZO (post-Lista B)</div>
      <div style={{border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 8px 8px",padding:16,marginBottom:16}}>
        <div style={S.grid2}>
          {[{k:"rlc",label:"Recuerdo Libre (máx. 16)"},{k:"rcc",label:"Recuerdo con Claves (máx. 16)"}].map(({k,label})=>{
            const n=norm?.[k]; const val=tavecData[k];
            const z=n&&val!==""&&val!==undefined?zScore(parseInt(val),n.m,n.s):null;
            const cls=classifyZ(z);
            return(
              <div key={k} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:12}}>
                <label style={S.label}>{label}</label>
                <input type="number" min={0} max={16} style={S.input} value={val||""} onChange={e=>up(k,e.target.value)} placeholder="0-16"/>
                {n&&<p style={{margin:"4px 0 0",fontSize:11,color:C.textLight,fontFamily:font}}>M={n.m} DS={n.s}</p>}
                {z!==null&&cls&&<div style={{marginTop:6,display:"flex",gap:8,alignItems:"center"}}><span style={{fontFamily:font,fontWeight:700,fontSize:13,color:cls?cls.color:C.textLight}}>Z={z>0?"+":""}{z}</span><span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span></div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Long term recall */}
      <div style={{background:"#6d28d9",color:"white",padding:"8px 16px",borderRadius:"8px 8px 0 0",fontWeight:700,fontFamily:font,fontSize:14}}>RECUERDO A LARGO PLAZO (~20 minutos)</div>
      <div style={{border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 8px 8px",padding:16,marginBottom:16}}>
        <div style={S.grid3}>
          {[{k:"rlld",label:"Recuerdo Libre"},{k:"rcld",label:"Recuerdo con Claves"},{k:"recog",label:"Reconocimiento (máx. 16)"}].map(({k,label})=>{
            const n=norm?.[k]; const val=tavecData[k];
            const z=n&&val!==""&&val!==undefined?zScore(parseInt(val),n.m,n.s):null;
            const cls=classifyZ(z);
            return(
              <div key={k} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:12}}>
                <label style={S.label}>{label}</label>
                <input type="number" min={0} max={16} style={S.input} value={val||""} onChange={e=>up(k,e.target.value)} placeholder="0-16"/>
                {n&&<p style={{margin:"4px 0 0",fontSize:11,color:C.textLight,fontFamily:font}}>M={n.m} DS={n.s}</p>}
                {z!==null&&cls&&<div style={{marginTop:6,display:"flex",gap:8,alignItems:"center"}}><span style={{fontFamily:font,fontWeight:700,fontSize:13,color:cls?cls.color:C.textLight}}>Z={z>0?"+":""}{z}</span><span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span></div>}
              </div>
            );
          })}
        </div>
        <div style={{...S.grid2,marginTop:12}}>
          {[{k:"intLC",label:"Intrusiones Corto Plazo"},{k:"intLD",label:"Intrusiones Largo Plazo"}].map(({k,label})=>(
            <div key={k} style={S.formGroup}>
              <label style={S.label}>{label}</label>
              <input type="number" min={0} style={S.input} value={tavecData[k]||""} onChange={e=>up(k,e.target.value)} placeholder="0"/>
            </div>
          ))}
        </div>
      </div>
      <div style={{background:`${C.primary}08`,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 18px"}}>
        <p style={{margin:0,fontSize:12,fontFamily:font,color:C.textDark}}>El TAVEC permite analizar: tasa de aprendizaje, efecto de interferencia proactiva/retroactiva, beneficio de claves semánticas (codificación vs recuperación), consolidación a largo plazo y discriminabilidad en reconocimiento.</p>
      </div>
    </div>
  );
}

function TAVECResults({r}){
  const {ag,norm,scores}=r;
  const measures=[
    {k:"A1",label:"Ensayo A1"},{k:"A2",label:"Ensayo A2"},{k:"A3",label:"Ensayo A3"},{k:"A4",label:"Ensayo A4"},{k:"A5",label:"Ensayo A5"},
    {k:"total",label:"Total A1-A5",max:80},{k:"B",label:"Lista B"},
    {k:"rlc",label:"Rec. Libre CP"},{k:"rcc",label:"Rec. Claves CP"},
    {k:"rlld",label:"Rec. Libre LP"},{k:"rcld",label:"Rec. Claves LP"},{k:"recog",label:"Reconocimiento"},
  ];

  // Benefit from cues (encoding vs retrieval hypothesis)
  const cpBenefit=scores.rcc&&scores.rlc?parseInt(scores.rcc)-parseInt(scores.rlc):null;
  const lpBenefit=scores.rcld&&scores.rlld?parseInt(scores.rcld)-parseInt(scores.rlld):null;

  return(
    <div style={S.card}>
      <h3 style={S.sectionTitle}>📚 TAVEC <span style={{fontSize:13,fontWeight:400,color:C.textLight}}>Benedet & Alejandre (1998) · Grupo {ag||"—"}</span></h3>
      <div style={{marginBottom:16}}>
        {measures.map(({k,label,max=16})=>{
          const val=parseInt(scores[k]);
          if(isNaN(val)) return null;
          const n=norm?.[k];
          const z=n?zScore(val,n.m,n.s):null;
          const cls=z!==null?classifyZ(z):{label:"—",color:C.textLight};
          const pct=(val/(max||16))*100;
          return(
            <div key={k} style={{display:"flex",alignItems:"center",gap:12,marginBottom:8}}>
              <span style={{fontFamily:font,fontWeight:700,fontSize:13,minWidth:150,color:C.textMid}}>{label}</span>
              <span style={{fontFamily:font,fontWeight:800,fontSize:16,minWidth:30,color:cls?cls.color:C.textLight}}>{val}</span>
              {z!==null&&<span style={{fontFamily:font,fontSize:12,color:C.textLight,minWidth:55}}>Z={z>0?"+":""}{z}</span>}
              {n&&<span style={{fontFamily:font,fontSize:11,color:C.textLight,minWidth:80}}>M={n.m} DS={n.s}</span>}
              <div style={{flex:1,height:8,background:C.border,borderRadius:4,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:cls?cls.color:C.textLight,borderRadius:4}}/></div>
              <span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span>
            </div>
          );
        })}
      </div>

      {(cpBenefit!==null||lpBenefit!==null)&&(
        <div style={{border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 18px",marginBottom:12}}>
          <p style={{margin:"0 0 10px",fontWeight:700,fontFamily:font,fontSize:13,color:C.primary}}>Beneficio de claves semánticas (hipótesis codificación vs recuperación):</p>
          {cpBenefit!==null&&<p style={{margin:"0 0 4px",fontSize:13,fontFamily:font,color:C.textDark}}>• Corto plazo: Rec. Claves – Libre = <strong style={{color:cpBenefit>3?C.danger:cpBenefit>1?C.warning:C.success}}>{cpBenefit>0?"+":""}{cpBenefit} palabras</strong> {cpBenefit>3?"— beneficio marcado: déficit de recuperación > codificación":cpBenefit>1?"— beneficio moderado":"— sin beneficio relevante"}</p>}
          {lpBenefit!==null&&<p style={{margin:0,fontSize:13,fontFamily:font,color:C.textDark}}>• Largo plazo: Rec. Claves – Libre = <strong style={{color:lpBenefit>3?C.danger:lpBenefit>1?C.warning:C.success}}>{lpBenefit>0?"+":""}{lpBenefit} palabras</strong></p>}
          <p style={{margin:"8px 0 0",fontSize:12,fontFamily:font,color:C.textLight}}>Beneficio {'>'} 3 palabras con claves sugiere déficit en recuperación espontánea con codificación relativamente preservada (perfil subcortical-frontal). Beneficio mínimo indica déficit en consolidación (hipocampal).</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── WMS-3 FORM & RESULTS ────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function WMS3Form({wms3Data,setWms3Data}){
  const up=(k,v)=>setWms3Data(d=>({...d,[k]:v}));
  return(
    <div style={S.card}>
      <h3 style={S.sectionTitle}>🧩 WMS-III — Escala de Memoria de Wechsler</h3>
      <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Wechsler (1997). TEA Ediciones (Adaptación española, 1998). Puntuaciones de índice: M=100, DS=15.</p>
      <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 16px"}}>Ingresar directamente los índices estandarizados (puntajes compuestos) tal como los proporciona el software de corrección WMS-III.</p>
      <div style={S.grid2}>
        {WMS3_INDEXES.map(idx=>{
          const val=wms3Data[idx.key];
          const cls=val?classifyWMS(val):null;
          return(
            <div key={idx.key} style={{border:`2px solid ${cls?cls.color+"40":C.border}`,borderRadius:12,padding:16,background:cls?cls.color+"08":"#fff"}}>
              <label style={{...S.label,color:idx.color}}>{idx.short} — {idx.label}</label>
              <p style={{margin:"0 0 8px",fontSize:11,color:C.textLight,fontFamily:font}}>{idx.comp}</p>
              <input type="number" min={40} max={160} style={S.input} value={val||""} onChange={e=>up(idx.key,e.target.value)} placeholder="40-160"/>
              {cls&&(
                <div style={{marginTop:10,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <div style={{fontFamily:font,fontSize:28,fontWeight:800,color:cls?cls.color:C.textLight}}>{cls.score}</div>
                  <div>
                    <div style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</div>
                    <div style={{fontSize:11,color:C.textLight,fontFamily:font,marginTop:4}}>Pc {cls.pct}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{background:`${C.primary}08`,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 18px",marginTop:8}}>
        <p style={{margin:0,fontSize:12,fontFamily:font,color:C.textDark}}>Disociaciones clave: MAI {'>'} MAD (déficit de consolidación); MI–MG (amnesia con aprendizaje normal); MAI vs MVI (modalidad específica); MI vs MT (memoria vs función ejecutiva).</p>
      </div>
    </div>
  );
}

function WMS3Results({r}){
  const filled=WMS3_INDEXES.filter(idx=>r[idx.key]&&r[idx.key]!=="");
  if(filled.length===0) return null;

  // Dissociation analysis
  const get=(k)=>parseInt(r[k])||null;
  const mai=get("mai"),mad=get("mad"),mvi=get("mvi"),mvd=get("mvd"),mi=get("mi"),mg=get("mg"),mt=get("mt"),rad=get("rad");

  const dissociations=[];
  if(mai&&mad&&mai-mad>15) dissociations.push({label:"MAI > MAD (+"+( mai-mad)+")",desc:"Déficit de consolidación auditiva-verbal.",sev:"high"});
  if(mvi&&mvd&&mvi-mvd>15) dissociations.push({label:"MVI > MVD (+"+( mvi-mvd)+")",desc:"Déficit de consolidación visual.",sev:"high"});
  if(mai&&mvi&&Math.abs(mai-mvi)>15) dissociations.push({label:`MAI ${mai>mvi?">":"<"} MVI (${Math.abs(mai-mvi)} pts)`,desc:"Asimetría modalidad auditiva vs visual.",sev:"moderate"});
  if(mg&&rad&&mg<90&&rad>=90) dissociations.push({label:"MG bajo con RAD normal",desc:"Déficit de recuperación libre con reconocimiento preservado (perfil subcortical/frontal).",sev:"moderate"});
  if(mi&&mt&&Math.abs(mi-mt)>15) dissociations.push({label:`Memoria ${mi>mt?">":" <"} Mem. Trabajo (${Math.abs(mi-mt)} pts)`,desc:`${mi>mt?"MT relativamente más afectada que memorias declarativas.":"Memoria declarativa más afectada que memoria de trabajo."}`,sev:"moderate"});

  return(
    <div style={S.card}>
      <h3 style={S.sectionTitle}>🧩 WMS-III — Escala de Memoria de Wechsler <span style={{fontSize:13,fontWeight:400,color:C.textLight}}>Wechsler (1997) · TEA Ediciones</span></h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
        {filled.map(idx=>{
          const cls=classifyWMS(r[idx.key]);
          const pct=((cls.score-40)/120)*100;
          return(
            <div key={idx.key} style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,fontFamily:font,color:idx.color,marginBottom:4}}>{idx.short}</div>
              <div style={{fontSize:36,fontWeight:800,fontFamily:font,color:cls?cls.color:C.textLight}}>{cls.score}</div>
              <div style={{marginTop:6}}><span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span></div>
              <div style={{fontSize:11,color:C.textLight,fontFamily:font,marginTop:4}}>Pc {cls.pct}</div>
              <div style={S.barContainer}><div style={S.bar(pct,cls?cls.color:C.primary)}/></div>
            </div>
          );
        })}
      </div>

      {/* Bands reference */}
      <div style={{border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 18px",marginBottom:16}}>
        <p style={{margin:"0 0 8px",fontWeight:700,fontFamily:font,fontSize:13,color:C.primary}}>Clasificación por bandas (M=100, DS=15):</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {WMS3_BANDS.map(b=><span key={b.label} style={{...S.badge(b.color),fontSize:11}}>{b.label} ≥{b.min} (Pc {b.pct})</span>)}
        </div>
      </div>

      {dissociations.length>0&&(
        <div style={{background:`${C.danger}08`,border:`1px solid ${C.danger}30`,borderRadius:10,padding:"14px 18px",marginBottom:12}}>
          <p style={{margin:"0 0 8px",fontWeight:700,fontFamily:font,fontSize:13,color:C.danger}}>⚠ Disociaciones clínicas detectadas:</p>
          {dissociations.map((d,i)=>(
            <p key={i} style={{margin:"0 0 4px",fontSize:13,fontFamily:font,color:C.textDark}}>• <strong>{d.label}:</strong> {d.desc}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── AI REPORT GENERATOR ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// ─── PANEL DE REDACCIÓN CON PERFIL Z ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// Criterios de clasificación por Z (igual que IGP imagen 2)
const Z_BANDS=[
  {min:1.5,  max:99,  label:"Superior",              color:"#e8f5e9", textColor:"#2e7d32", border:"#81c784"},
  {min:-0.99,max:1.49,label:"Normal",                color:"#f0f4f8", textColor:"#37474f", border:"#b0bec5"},
  {min:-1.32,max:-1.0,label:"Límite inferior normativo",color:"#e3f2fd",textColor:"#1565c0",border:"#90caf9"},
  {min:-1.99,max:-1.33,label:"Dificultad leve",     color:"#fff8e1", textColor:"#e65100", border:"#ffcc02"},
  {min:-2.49,max:-2.0,label:"Dificultad moderada",  color:"#fce4ec", textColor:"#c62828", border:"#ef9a9a"},
  {min:-99,  max:-2.5,label:"Dificultad elevada",   color:"#ffebee", textColor:"#b71c1c", border:"#e57373"},
];
function getZBand(z){
  if(z===null||z===undefined||isNaN(parseFloat(z))) return null;
  const zf=parseFloat(z);
  return Z_BANDS.find(b=>zf>=b.min&&zf<=b.max)||Z_BANDS[Z_BANDS.length-1];
}

// Descripciones clínicas por variable de cada prueba
const VAR_DESCRIPTIONS={
  // TAVEC
  "RI-A1":"Recuerdo inmediato en el primer ensayo — refleja la capacidad inicial de codificación y captación de información nueva.",
  "RI-A5":"Recuerdo libre en el quinto ensayo — indica el aprendizaje máximo alcanzado a través de la práctica repetida.",
  "RI-AT":"Aprendizaje total (suma A1–A5) — refleja la curva de aprendizaje y la eficiencia de codificación general.",
  "RI-B":"Lista de interferencia — evalúa la susceptibilidad a la interferencia proactiva y retroactiva.",
  "RL-CP":"Recuerdo libre a corto plazo (demora corta) — memoria a corto plazo sin claves.",
  "RCL-CP":"Recuerdo con claves semánticas a corto plazo — capacidad de beneficio de claves para recuperar información.",
  "RL-LP":"Recuerdo libre a largo plazo (demora larga ~30 min) — consolidación y retención diferida.",
  "RCL-LP":"Recuerdo con claves a largo plazo — capacidad de recuperación con apoyo semántico.",
  "P":"Perseveraciones — repetición de palabras ya evocadas; puede indicar dificultades en monitoreo.",
  "L-LRL":"Intrusiones en recuerdo libre — palabras no pertenecientes a la lista; sensibilidad a interferencia.",
  "L-RCL":"Intrusiones en recuerdo con claves — indica confabulación o dificultad en discriminación.",
  "Reconocimiento":"Reconocimiento — distinguir la lista aprendida entre distractores; evalúa almacenamiento vs. recuperación.",
  "FP":"Falsos positivos en reconocimiento — aceptar distractores como correctos; sensibilidad a la interferencia.",
  "Discriminabilidad":"Índice de discriminabilidad — capacidad para distinguir estímulos de la lista de distractores semánticos.",
  // RAVLT
  "A1":"Ensayo 1 — captación inicial, refleja la capacidad de codificación primaria.",
  "A2":"Ensayo 2 — primer consolidado, indica aprendizaje incipiente.",
  "A3":"Ensayo 3 — aprendizaje intermedio.",
  "A4":"Ensayo 4 — consolidación progresiva.",
  "A5":"Ensayo 5 — rendimiento máximo de aprendizaje.",
  "B":"Lista interferente — susceptibilidad a interferencia proactiva.",
  "A6":"Recuerdo diferido inmediato post-interferencia.",
  "A7":"Recuerdo diferido a largo plazo (~20-30 min).",
  // TMT
  "TMT-A":"Velocidad de procesamiento, atención sostenida y rastreo visual.",
  "TMT-B":"Flexibilidad cognitiva, atención alternante y función ejecutiva.",
  "B-A":"Diferencia B-A — aisla el componente ejecutivo descartando la velocidad pura.",
  // Stroop
  "P":"Velocidad de lectura de palabras — automatización lectora, velocidad de procesamiento.",
  "C":"Velocidad de denominación de colores — procesamiento atencional sostenido.",
  "PC":"Color-Palabra — capacidad de inhibir respuesta automática, control inhibitorio.",
  "Interferencia":"Índice de interferencia — resistencia a la interferencia y control ejecutivo.",
  // WAIS-IV
  "CIT":"Cociente Intelectual Total — estimación del funcionamiento cognitivo global.",
  "ICV":"Índice de Comprensión Verbal — razonamiento verbal, conocimiento adquirido, expresión verbal.",
  "IRP":"Índice de Razonamiento Perceptivo — razonamiento no verbal, organización perceptiva, integración visuoespacial.",
  "IMT":"Índice de Memoria de Trabajo — retención y manipulación mental de información.",
  "IVP":"Índice de Velocidad de Procesamiento — rapidez y precisión en tareas cognitivas simples.",
  // BADS
  "Perfil BADS":"Perfil total del BADS — funcionamiento ejecutivo en contextos ecológicos.",
  // FV
  "Semántica":"Fluidez semántica — acceso al léxico organizado por categorías, función del lóbulo temporal y frontal.",
  "Fonológica":"Fluidez fonológica — acceso lexical controlado, función frontoestriatal.",
  // BNT
  "BNT-60":"Denominación por confrontación visual — acceso al léxico, función temporal izquierda.",
  "BNT-12":"Versión abreviada para screening de anomia.",
  // PAPDI
  "Libre":"Denominación espontánea — acceso lexical sin ayuda.",
  "Guiada":"Denominación con pista fonológica — recuperación asistida.",
  // MoCA
  "MoCA":"Screening cognitivo global — detecta deterioro cognitivo leve.",
  // WCST
  "Categorías":"Número de categorías completadas — capacidad de abstracción y formación de conceptos.",
  "Errores totales":"Total de errores — dificultad global en el aprendizaje de reglas abstractas.",
  "Errores perseverativos":"Perseveración — incapacidad de abandonar una estrategia errónea; función prefrontal.",
  // IFS
  "IFS Total":"Funcionamiento frontal global — sensible a disfunción ejecutiva temprana.",
};

function ZBadge({z,invertido}){
  const zf=z!==null&&z!==undefined&&!isNaN(parseFloat(z))?parseFloat(z):null;
  const band=zf!==null?getZBand(invertido?-zf:zf):null;
  if(!band||zf===null) return <span style={{fontFamily:font,fontSize:12,color:"#aaa"}}>—</span>;
  return(
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      <span style={{fontFamily:font,fontSize:13,fontWeight:700,minWidth:50,color:band.textColor}}>{zf>0?"+":""}{zf.toFixed(2)}</span>
      <span style={{padding:"2px 8px",borderRadius:4,background:band.color,color:band.textColor,border:`1px solid ${band.border}`,fontSize:11,fontFamily:font,fontWeight:600,whiteSpace:"nowrap"}}>{band.label}</span>
    </div>
  );
}

function PruebaDetail({title,rows,source}){
  const [open,setOpen]=useState(false);
  const hasSignificant=rows.some(r=>r.z!==null&&!isNaN(parseFloat(r.z))&&parseFloat(r.z)<=-1.0);
  return(
    <div style={{borderRadius:8,border:`1px solid ${hasSignificant?"#ef9a9a":"#e0e0e0"}`,marginBottom:8,overflow:"hidden"}}>
      <div onClick={()=>setOpen(o=>!o)} style={{padding:"8px 14px",cursor:"pointer",background:hasSignificant?"#fff5f5":"#f8f9fa",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontFamily:font,fontSize:13,fontWeight:700,color:"#2d4a6e"}}>{title}</span>
          {hasSignificant&&<span style={{fontSize:10,background:"#fce4ec",color:"#c62828",padding:"1px 6px",borderRadius:3,fontFamily:font}}>Alteración</span>}
        </div>
        <span style={{color:"#888",fontSize:12}}>{open?"▲":"▼"}</span>
      </div>
      {open&&(
        <div>
          {source&&<div style={{padding:"4px 14px",background:"#f0f4f8",fontFamily:font,fontSize:10,color:"#607d8b"}}>Baremo: {source}</div>}
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"#37474f",color:"white"}}>
                <th style={{padding:"5px 10px",textAlign:"left",fontFamily:font,fontSize:11,fontWeight:700}}>Variable</th>
                <th style={{padding:"5px 8px",textAlign:"center",fontFamily:font,fontSize:11,fontWeight:700}}>PB</th>
                <th style={{padding:"5px 8px",textAlign:"center",fontFamily:font,fontSize:11,fontWeight:700}}>M</th>
                <th style={{padding:"5px 8px",textAlign:"center",fontFamily:font,fontSize:11,fontWeight:700}}>DT</th>
                <th style={{padding:"5px 8px",textAlign:"left",fontFamily:font,fontSize:11,fontWeight:700}}>Z / Clasificación</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row,i)=>{
                const desc=VAR_DESCRIPTIONS[row.label]||VAR_DESCRIPTIONS[row.varKey]||null;
                return(
                  <React.Fragment key={i}>
                    <tr style={{background:i%2===0?"#fff":"#fafafa"}}>
                      <td style={{padding:"6px 10px",fontFamily:font,fontSize:12,color:"#263238",fontWeight:600}}>{row.label}</td>
                      <td style={{padding:"6px 8px",textAlign:"center",fontFamily:font,fontSize:12,color:"#455a64"}}>{row.pb!==undefined&&row.pb!==null?row.pb:"—"}</td>
                      <td style={{padding:"6px 8px",textAlign:"center",fontFamily:font,fontSize:11,color:"#78909c"}}>{row.m!==undefined&&row.m!==null?parseFloat(row.m).toFixed(2):"—"}</td>
                      <td style={{padding:"6px 8px",textAlign:"center",fontFamily:font,fontSize:11,color:"#78909c"}}>{row.dt!==undefined&&row.dt!==null?parseFloat(row.dt).toFixed(2):"—"}</td>
                      <td style={{padding:"6px 10px"}}><ZBadge z={row.z} invertido={row.invertido}/></td>
                    </tr>
                    {desc&&<tr style={{background:i%2===0?"#fafff8":"#f5fff0"}}><td colSpan={5} style={{padding:"3px 12px 6px 20px",fontFamily:font,fontSize:10,color:"#546e7a",fontStyle:"italic",borderBottom:"1px solid #e0e0e0"}}>{desc}</td></tr>}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PerfilZPanel({results,patient}){
  const sections=[];

  // ── Screening ──
  const scrRows=[];
  if(results.moca) scrRows.push({label:"MoCA",pb:results.moca.total+"/30",z:null,m:null,dt:null,interp:results.moca.label});
  if(scrRows.length) sections.push({title:"Cognitivo Global",source:"Lozano et al. (2009)",rows:scrRows});

  // ── Atención ──
  const atRows=[];
  if(results.tmt?.timeA){const n=results.tmt.normA;atRows.push({label:"TMT-A · tiempo (seg)",pb:results.tmt.timeA,z:results.tmt.zA,m:n?.mean,dt:n?.sd,invertido:true});}
  if(results.tmt?.timeB){const n=results.tmt.normB;atRows.push({label:"TMT-B · tiempo (seg)",pb:results.tmt.timeB,z:results.tmt.zB,m:n?.mean,dt:n?.sd,invertido:true});}
  if(results.tmt?.zBminusA!==undefined) atRows.push({label:"TMT · Índice B-A",pb:"",z:results.tmt.zBminusA,m:null,dt:null,invertido:true});
  if(results.stroop){const s=results.stroop;
    if(s.rawP!==undefined) atRows.push({label:"Stroop · P (Palabras)",pb:s.rawP,z:s.zP,m:s.galNorm?.P?.m,dt:s.galNorm?.P?.s});
    if(s.rawC!==undefined) atRows.push({label:"Stroop · C (Colores)",pb:s.rawC,z:s.zC,m:s.galNorm?.C?.m,dt:s.galNorm?.C?.s});
    if(s.rawPC!==undefined) atRows.push({label:"Stroop · PC (Color-Palabra)",pb:s.rawPC,z:s.zPC,m:s.galNorm?.PC?.m,dt:s.galNorm?.PC?.s});
    if(s.interference!==undefined) atRows.push({label:"Stroop · Interferencia",pb:s.interference,z:s.zInterf,m:s.galNorm?.Interf?.m,dt:s.galNorm?.Interf?.s});
  }
  if(results.caras) atRows.push({label:"CARAS-R · A-E",pb:results.caras.AE,z:results.caras.zAE,m:CARAS_NORMS[results.caras.grade]?.AE?.m,dt:CARAS_NORMS[results.caras.grade]?.AE?.sd});
  if(atRows.length) sections.push({title:"Atención y Velocidad de Procesamiento",source:"Galaverna et al. (2014) ARG / Tombaugh (2004)",rows:atRows});

  // ── Memoria Verbal ──
  const mvRows=[];
  if(results.tavec?.scores){
    const tv=results.tavec;const ag=tv.ag;const n=TAVEC_NORMS[ag];
    const tavMap={A1:"RI-A1",A5:"RI-A5",AT:"RI-AT",B:"RI-B",rlc:"RL-CP",rcc:"RCL-CP",rlld:"RL-LP",rcld:"RCL-LP",P:"P",LRL:"L-IRL",LRCL:"L-IRCL",recog:"Reconocimiento",FP:"FP",disc:"Discriminabilidad"};
    const tavKeys=["A1","A5","AT","B","rlc","rcc","rlld","rcld","P","recog","FP","disc"];
    tavKeys.forEach(k=>{
      const v=tv.scores[k];
      if(v!==undefined&&v!==""){
        const nn=n?.[k];
        const z=nn?parseFloat(((parseFloat(v)-nn.m)/nn.s).toFixed(2)):null;
        const isPers=k==="P"||k==="FP"||k==="LRL"||k==="LRCL";
        mvRows.push({label:"TAVEC · "+(tavMap[k]||k),varKey:tavMap[k]||k,pb:v,z:isPers?-z:z,m:nn?.m,dt:nn?.s,invertido:isPers});
      }
    });
  }
  if(results.ravlt?.scores){
    const rv=results.ravlt;const ag=rv.adultGroup;const n=RAVLT_ADULT_NORMS[ag];
    ["A1","A2","A3","A4","A5","B","A6","A7"].forEach(k=>{
      const v=rv.scores[k];
      if(v!==undefined&&v!==""){
        const nn=n?.[k.toLowerCase()]||n?.[k];
        const z=nn?parseFloat(((parseFloat(v)-nn.m)/nn.s).toFixed(2)):null;
        mvRows.push({label:"RAVLT · "+k,varKey:k,pb:v,z:z,m:nn?.m,dt:nn?.s});
      }
    });
  }
  if(mvRows.length) sections.push({title:"Memoria Verbal",source:"TAVEC: Benedet & Alejandre (1998) | RAVLT: Adaptación ARG",rows:mvRows});

  // ── Memoria no Verbal ──
  const mnvRows=[];
  if(results.rey){
    const r=results.rey;
    if(r.copia!==null) mnvRows.push({label:"Rey-Osterrieth · Copia",pb:r.copia+"/36",z:null,m:null,dt:null,interp:r.copiaPC?"P"+r.copiaPC:""});
    if(r.memoria!==null) mnvRows.push({label:"Rey-Osterrieth · Memoria diferida",pb:r.memoria+"/36",z:null,m:null,dt:null,interp:r.memoriaPC?"P"+r.memoriaPC:""});
    if(r.retencion!==null) mnvRows.push({label:"Rey-Osterrieth · Retención",pb:r.retencion+"%",z:null,m:null,dt:null});
  }
  if(results.wms3){
    WMS3_INDEXES.filter(i=>results.wms3[i.key]).forEach(i=>{
      const v=parseInt(results.wms3[i.key]);
      const z=parseFloat(((v-100)/15).toFixed(2));
      mnvRows.push({label:"WMS-III · "+i.label,pb:v,z:z,m:100,dt:15});
    });
  }
  if(mnvRows.length) sections.push({title:"Memoria No Verbal y Visuoconstrucción",source:"TEA (1994) / WMS-III TEA",rows:mnvRows});

  // ── Lenguaje ──
  const langRows=[];
  if(results.fv){
    if(results.fv.semantic) langRows.push({label:"FV · Semántica",varKey:"Semántica",pb:results.fv.semantic,z:results.fv.zSem,m:results.fv.normSem?.mean,dt:results.fv.normSem?.sd});
    if(results.fv.phonologic) langRows.push({label:"FV · Fonológica",varKey:"Fonológica",pb:results.fv.phonologic,z:results.fv.zFon,m:results.fv.normFon?.mean,dt:results.fv.normFon?.sd});
  }
  if(results.papdi) langRows.push({label:"PAPDI · Denominación libre",varKey:"Libre",pb:results.papdi.score+"/30",z:results.papdi.z});
  if(results.bnt){
    const lbl=results.bnt.mode==="60"?"BNT-60":"BNT-12";
    langRows.push({label:lbl,varKey:lbl,pb:results.bnt.score,z:results.bnt.z||null});
  }
  if(langRows.length) sections.push({title:"Lenguaje y Denominación",source:"Allegri/Fernández et al. ARG",rows:langRows});

  // ── Función Ejecutiva ──
  const feRows=[];
  if(results.wcst){
    const ag=results.wcst.ageGroup;const n=ag?WCST_NORMS[ag]:null;const sc=results.wcst.scores;
    if(sc.categories!==undefined){const z=n?parseFloat(((parseFloat(sc.categories)-n.categories.m)/n.categories.s).toFixed(2)):null;feRows.push({label:"WCST · Categorías",varKey:"Categorías",pb:sc.categories,z:z,m:n?.categories.m,dt:n?.categories.s});}
    if(sc.totalErrors!==undefined){const z=n?-parseFloat(((parseFloat(sc.totalErrors)-n.totalErrors.m)/n.totalErrors.s).toFixed(2)):null;feRows.push({label:"WCST · Errores totales",varKey:"Errores totales",pb:sc.totalErrors,z:z,m:n?.totalErrors.m,dt:n?.totalErrors.s,invertido:true});}
    if(sc.persevErrors!==undefined){const z=n?-parseFloat(((parseFloat(sc.persevErrors)-n.persevErrors.m)/n.persevErrors.s).toFixed(2)):null;feRows.push({label:"WCST · Errores perseverativos",varKey:"Errores perseverativos",pb:sc.persevErrors,z:z,m:n?.persevErrors.m,dt:n?.persevErrors.s,invertido:true});}
  }
  if(results.ifs) feRows.push({label:"IFS · Total",varKey:"IFS Total",pb:results.ifs.total.toFixed(1)+"/30",z:null,interp:results.ifs.below?"Bajo corte":"Normal"});
  if(results.bads) feRows.push({label:"BADS · Perfil total",varKey:"Perfil BADS",pb:results.bads.total+"/24",z:results.bads.z,m:BADS_NORMS.m,dt:BADS_NORMS.sd});
  if(results.hotel?.norm){
    const hn=results.hotel.norm;const hd=results.hotel.data;
    if(hd.tareas) feRows.push({label:"Hotel · Tareas realizadas",pb:hd.tareas,z:parseFloat(((parseFloat(hd.tareas)-hn.tareasM)/hn.tareasSD).toFixed(2)),m:hn.tareasM,dt:hn.tareasSD});
  }
  if(feRows.length) sections.push({title:"Función Ejecutiva",source:"Axelrod (1993) / Torralva (2009) ARG / Farías Sarquís (2021) ARG",rows:feRows});

  // ── Inteligencia ──
  const intRows=[];
  if(results.wais){
    WAIS_INDEXES.filter(i=>results.wais[i.key]&&parseInt(results.wais[i.key])>0).forEach(i=>{
      const v=parseInt(results.wais[i.key]);
      intRows.push({label:"WAIS-IV · "+i.label,varKey:i.short,pb:v,z:parseFloat(((v-100)/15).toFixed(2)),m:100,dt:15});
    });
  }
  if(results.wisc5){
    WISC5_INDEXES.filter(i=>i.type==="principal"&&results.wisc5.indexes[i.key]).forEach(i=>{
      const r=results.wisc5.indexes[i.key];
      intRows.push({label:"WISC-V · "+i.label,varKey:i.abbr,pb:r.val,z:parseFloat(((r.val-100)/15).toFixed(2)),m:100,dt:15});
    });
  }
  if(intRows.length) sections.push({title:"Inteligencia",source:"WAIS-IV/WISC-V: Rosas & Pizarro (Chile) — M=100 DS=15",rows:intRows});

  // ── Cuestionarios ──
  const cuest=[];
  if(results.scl90){
    const sigDims=Object.entries(SCL90_DIMS).filter(([dk])=>results.scl90.dims[dk]).map(([dk,dd])=>{
      const ds=results.scl90.dims[dk];
      return{label:"SCL-90-R · "+dd.label,pb:ds.raw.toFixed(2),z:parseFloat(((ds.raw-SCL90_NORMS[patient.sex?.includes("Mas")?"M":"F"][dk].m)/SCL90_NORMS[patient.sex?.includes("Mas")?"M":"F"][dk].sd).toFixed(2)),m:SCL90_NORMS[patient.sex?.includes("Mas")?"M":"F"][dk].m,dt:SCL90_NORMS[patient.sex?.includes("Mas")?"M":"F"][dk].sd};
    });
    cuest.push(...sigDims);
  }
  if(results.wurs) cuest.push({label:"WURS-25",pb:results.wurs.score25,z:results.wurs.z25,m:WURS_NORM_ARG.mean,dt:WURS_NORM_ARG.sd});
  if(results.asrs){
    cuest.push({label:"ASRS · Total",pb:results.asrs.scoreT,z:results.asrs.zT,m:30.22,dt:10.70});
    cuest.push({label:"ASRS · Inatención",pb:results.asrs.scoreI,z:results.asrs.zI,m:15.22,dt:5.61});
    cuest.push({label:"ASRS · Hiperactividad",pb:results.asrs.scoreH,z:results.asrs.zH,m:14.96,dt:6.25});
  }
  if(cuest.length) sections.push({title:"Cuestionarios",source:"Scandar (2021) ARG / Casullo & Pérez (1999/2008) ARG",rows:cuest});

  // Leyenda de colores
  const leyenda=[
    {label:"Superior",color:"#e8f5e9",text:"#2e7d32"},{label:"Normal",color:"#f0f4f8",text:"#37474f"},
    {label:"Límite inf.",color:"#e3f2fd",text:"#1565c0"},{label:"Dif. leve",color:"#fff8e1",text:"#e65100"},
    {label:"Dif. moderada",color:"#fce4ec",text:"#c62828"},{label:"Dif. elevada",color:"#ffebee",text:"#b71c1c"},
  ];

  return(
    <div style={{height:"100%",overflowY:"auto",padding:16}}>
      <div style={{fontFamily:font,fontSize:14,fontWeight:700,color:"#2d4a6e",marginBottom:8}}>
        Perfil Z — {patient.name||"Paciente"}
      </div>
      {/* Leyenda */}
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:12}}>
        {leyenda.map(l=>(
          <span key={l.label} style={{padding:"2px 8px",borderRadius:4,background:l.color,color:l.text,fontSize:10,fontFamily:font,border:"1px solid #ddd"}}>{l.label}</span>
        ))}
      </div>
      {sections.length===0&&<div style={{fontFamily:font,fontSize:12,color:"#aaa",textAlign:"center",marginTop:40}}>Completá las pruebas para ver el perfil Z aquí.</div>}
      {sections.map((sec,si)=>(
        <PruebaDetail key={si} title={sec.title} rows={sec.rows} source={sec.source}/>
      ))}
    </div>
  );
}

function buildZRows(results,adminTests){
  const rows=[];
  const adm=adminTests||{};
  const add=(label,pb,z,cls)=>rows.push({label,pb:pb!==null&&pb!==undefined?String(pb):"—",z:z!==null&&z!==undefined?String(z):"—",cls:cls||"—"});
  if(results.moca&&adm.moca) add("MoCA",results.moca.total+"/30",null,results.moca.label);
  if(results.tmt?.timeA&&adm.tmtfv){add("TMT-A (tiempo)",results.tmt.timeA+"s",results.tmt.zA,classifyZ(results.tmt.zA).label);if(results.tmt.timeB)add("TMT-B (tiempo)",results.tmt.timeB+"s",results.tmt.zB,classifyZ(results.tmt.zB).label);}
  if(results.stroop&&adm.stroop){const s=results.stroop;if(s.rawP)add("Stroop – P",s.rawP,s.zP,classifyZ(s.zP).label);if(s.rawC)add("Stroop – C",s.rawC,s.zC,classifyZ(s.zC).label);if(s.rawPC)add("Stroop – PC",s.rawPC,s.zPC,classifyZ(s.zPC).label);}
  if(results.waisAtten){if(results.waisAtten.rdPE)add("WAIS-IV – RD (PE)",results.waisAtten.rdPE,results.waisAtten.zRD,classifyZ(results.waisAtten.zRD).label);if(results.waisAtten.claPE)add("WAIS-IV – CLA (PE)",results.waisAtten.claPE,results.waisAtten.zCLA,classifyZ(results.waisAtten.zCLA).label);if(results.waisAtten.slnPE)add("WMS-III – SLN (PE)",results.waisAtten.slnPE,results.waisAtten.zSLN,classifyZ(results.waisAtten.zSLN).label);}
  if(results.fv&&adm.tmtfv){if(results.fv.semantic)add("FV Semántica",results.fv.semantic,results.fv.zSem,classifyZ(results.fv.zSem).label);if(results.fv.phonologic)add("FV Fonológica",results.fv.phonologic,results.fv.zFon,classifyZ(results.fv.zFon).label);}
  if(results.ravlt&&adm.ravlt&&results.ravlt.scores){["A1","A5","A6","A7"].forEach(k=>{const v=results.ravlt.scores[k];if(v)add("RAVLT – "+k,v,null,"—");});}
  if(results.tavec&&adm.tavec&&results.tavec.scores){const tv=results.tavec;["A1","A5","AT","B","rlc","rlld"].forEach(k=>{const v=tv.scores[k];if(v!==undefined&&v!==""){const n=TAVEC_NORMS?.[tv.ag]?.[k];const z=n?parseFloat(((parseFloat(v)-n.m)/n.s).toFixed(2)):null;add("TAVEC – "+k,v,z,z!==null?classifyZ(z).label:"—");}});}
  if(results.wais&&adm.waisiv){WAIS_INDEXES.filter(i=>results.wais[i.key]&&parseInt(results.wais[i.key])>0).forEach(i=>{const v=parseInt(results.wais[i.key]);const z=parseFloat(((v-100)/15).toFixed(2));add("WAIS-IV – "+i.short,v,z,classifyWAIS(v).label);});}
  if(results.wisc5&&adm.wiscv){WISC5_INDEXES.filter(i=>i.type==="principal"&&results.wisc5.indexes[i.key]).forEach(i=>{const r=results.wisc5.indexes[i.key];const z=parseFloat(((r.val-100)/15).toFixed(2));add("WISC-V – "+i.abbr,r.val,z,r.cls?r.cls.label:"—");});}
  if(results.bads&&adm.bads)add("BADS – Perfil",results.bads.total+"/24",results.bads.z,classifyZ(results.bads.z).label);
  if(results.rey&&adm.rey){if(results.rey.copia!==null)add("Rey – Copia",results.rey.copia+"/36","P"+results.rey.copiaPC,"");if(results.rey.memoria!==null)add("Rey – Memoria",results.rey.memoria+"/36","P"+results.rey.memoriaPC,"");if(results.rey.retencion!==null)add("Rey – Retención",results.rey.retencion+"%","","");}
  if(results.papdi&&adm.papdi)add("PAPDI",results.papdi.score+"/30",results.papdi.z,results.papdi.label);
  if(results.bnt&&adm.bnt)add("BNT-"+results.bnt.mode,results.bnt.score,results.bnt.z||null,results.bnt.label);
  if(results.wcst&&adm.wcst&&results.wcst.scores){const ag=results.wcst.ageGroup;const n=ag?WCST_NORMS[ag]:null;const sc=results.wcst.scores;if(sc.categories!==undefined){const z=n?parseFloat(((parseFloat(sc.categories)-n.categories.m)/n.categories.s).toFixed(2)):null;add("WCST – Categorías",sc.categories,z,z!==null?classifyZ(z).label:"—");}if(sc.persevErrors!==undefined){const z=n?-parseFloat(((parseFloat(sc.persevErrors)-n.persevErrors.m)/n.persevErrors.s).toFixed(2)):null;add("WCST – Errores perseverativos",sc.persevErrors,z,z!==null?classifyZ(z).label:"—");}}
  if(results.ifs&&adm.ifs)add("IFS",results.ifs.total.toFixed(1)+"/30",null,results.ifs.below?"Bajo corte":"Normal");
  if(results.scl90&&adm.scl90){Object.entries(SCL90_DIMS).forEach(([dk,dd])=>{const ds=results.scl90.dims[dk];if(ds)add("SCL-90-R – "+dd.label,ds.raw.toFixed(2),"T="+ds.t,ds.cls?ds.cls.label:"—");});}
  if(results.snap&&adm.snap)add("SNAP-IV",`DA=${results.snap.sumDA} HI=${results.snap.sumHI}`,null,results.snap.subtype);
  if(results.wurs&&adm.wurs)add("WURS-25",results.wurs.score25,results.wurs.z25,results.wurs.cutScandar?"Sugestivo TDAH":"Por debajo del corte");
  if(results.asrs&&adm.asrs)add("ASRS v1.1 – Total",results.asrs.scoreT+"/72",results.asrs.zT,"P"+results.asrs.pctT);
  return rows;
}

function generateWordHTML(patient,evalMeta,logo1,logo2,conducta,resultados,conclusiones,recomendaciones,rows){
  const logoHeader=`<table style="width:100%;border:none;margin-bottom:20pt;"><tr><td style="border:none;width:50%;">${logo1?`<img src="${logo1}" style="height:55px;">`:"&nbsp;"}</td><td style="border:none;width:50%;text-align:right;">${logo2?`<img src="${logo2}" style="height:55px;">`:"&nbsp;"}</td></tr></table>`;
  const zTable=rows.length>0?`<h2 style="font-family:Garamond,'Times New Roman',serif;font-size:13pt;color:#7E222E;margin-top:20pt;">Perfil de puntajes Z</h2>
    <table style="border-collapse:collapse;width:100%;font-family:Garamond,'Times New Roman',serif;font-size:10pt;">
      <tr style="background-color:#7E222E;color:white;"><th style="padding:5pt 8pt;border:1px solid #ccc;">Test / Variable</th><th style="padding:5pt 8pt;border:1px solid #ccc;width:60pt;">PB</th><th style="padding:5pt 8pt;border:1px solid #ccc;width:50pt;">Z</th><th style="padding:5pt 8pt;border:1px solid #ccc;width:130pt;">Clasificación</th></tr>
      ${rows.map((r,i)=>`<tr style="background:${i%2===0?"#fff":"#fdf6f7"};"><td style="padding:4pt 8pt;border:1px solid #ddd;">${r.label}</td><td style="padding:4pt 8pt;border:1px solid #ddd;text-align:center;">${r.pb}</td><td style="padding:4pt 8pt;border:1px solid #ddd;text-align:center;font-weight:bold;">${r.z}</td><td style="padding:4pt 8pt;border:1px solid #ddd;">${r.cls}</td></tr>`).join("")}
    </table>`:""
  return`<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Informe Neuropsicológico</title><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]--><style>@page{margin:2cm 2.5cm;}body{font-family:Garamond,'Times New Roman',Times,serif;font-size:12pt;color:#1a0007;line-height:1.6;}h1{font-size:16pt;color:#7E222E;border-bottom:2px solid #7E222E;padding-bottom:4pt;font-family:Garamond,'Times New Roman',serif;}h2{font-size:13pt;color:#7E222E;margin-top:16pt;font-family:Garamond,'Times New Roman',serif;}p{text-align:justify;margin:8pt 0;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ccc;padding:5pt 8pt;}th{background:#7E222E;color:white;}</style></head><body>${logoHeader}<h1>Informe Neuropsicológico</h1><table style="border:none;width:100%;margin-bottom:12pt;"><tr><td style="border:none;padding:4pt;"><b style="font-size:9pt;color:#7E222E;text-transform:uppercase;">Paciente</b><br>${patient.name||"—"}</td><td style="border:none;padding:4pt;"><b style="font-size:9pt;color:#7E222E;text-transform:uppercase;">Fecha</b><br>${patient.date||"—"}</td><td style="border:none;padding:4pt;"><b style="font-size:9pt;color:#7E222E;text-transform:uppercase;">Edad</b><br>${patient.age||"—"} años</td><td style="border:none;padding:4pt;"><b style="font-size:9pt;color:#7E222E;text-transform:uppercase;">Escolaridad</b><br>${patient.education||"—"}</td></tr>${evalMeta.evaluador||evalMeta.dni?`<tr><td style="border:none;padding:4pt;">${evalMeta.evaluador?`<b style="font-size:9pt;color:#7E222E;text-transform:uppercase;">Evaluado por</b><br>${evalMeta.evaluador}`:""}</td><td style="border:none;padding:4pt;">${evalMeta.derivadoPor?`<b style="font-size:9pt;color:#7E222E;text-transform:uppercase;">Derivado por</b><br>${evalMeta.derivadoPor}`:""}</td><td style="border:none;padding:4pt;">${evalMeta.dni?`<b style="font-size:9pt;color:#7E222E;text-transform:uppercase;">DNI</b><br>${evalMeta.dni}`:""}</td><td style="border:none;padding:4pt;">${evalMeta.ocupacion?`<b style="font-size:9pt;color:#7E222E;text-transform:uppercase;">Ocupación</b><br>${evalMeta.ocupacion}`:""}</td></tr>`:""}</table>${conducta?`<h2>Descripción de la conducta durante la evaluación</h2><div style="border-left:4px solid #7E222E;padding-left:12pt;">${conducta.split("\n").filter(p=>p.trim()).map(p=>`<p>${p}</p>`).join("")}</div>`:""}<h2>Resultados</h2>${resultados.split("\n").filter(p=>p.trim()).map(p=>`<p>${p}</p>`).join("")||"<p>(Sin redacción)</p>"}${zTable}${conclusiones?`<h2>Conclusiones</h2>${conclusiones.split("\n").filter(p=>p.trim()).map(p=>`<p>${p}</p>`).join("")}`:""} ${recomendaciones?`<h2>Recomendaciones</h2>${recomendaciones.split("\n").filter(p=>p.trim()).map(p=>`<p>${p}</p>`).join("")}`:""}</body></html>`;
}

function InformeEditor({results,patient,adminTests}){
  const [logo1,setLogo1]=useState(null);
  const [logo2,setLogo2]=useState(null);
  const [evalMeta,setEvalMeta]=useState({evaluador:"",derivadoPor:"",dni:"",ocupacion:"",procedencia:"",dominancia:""});
  const upMeta=(k,v)=>setEvalMeta(m=>({...m,[k]:v}));
  const [conducta,setConducta]=useState("");
  const [resultados,setResultados]=useState("");
  const [conclusiones,setConclusiones]=useState("");
  const [recomendaciones,setRecomendaciones]=useState("");

  // Logo predeterminado (Adriana Meléndez — base64 PNG)
  const DEFAULT_LOGO1 = "data:image/png;base64,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";
  // Cargar logos desde storage al montar; usar predeterminado si no hay guardado
  useEffect(()=>{
    window.storage.get("logo1_b64").then(r=>{
      if(r&&r.value) setLogo1(r.value);
      else setLogo1(DEFAULT_LOGO1);
    }).catch(()=>{ setLogo1(DEFAULT_LOGO1); });
    window.storage.get("logo2_b64").then(r=>{if(r&&r.value)setLogo2(r.value);}).catch(()=>{});
  },[]);

  function handleLogo(e,num){
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
      const b64=reader.result;
      if(num===1){setLogo1(b64);window.storage.set("logo1_b64",b64).catch(()=>{});}
      else{setLogo2(b64);window.storage.set("logo2_b64",b64).catch(()=>{});}
    };
    reader.readAsDataURL(file);
  }

  function exportWord(){
    const rows=buildZRows(results,adminTests);
    const html=generateWordHTML(patient,evalMeta,logo1,logo2,conducta,resultados,conclusiones,recomendaciones,rows);
    const blob=new Blob(["\ufeff"+html],{type:"application/msword;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download=`Informe_${(patient.name||"paciente").replace(/ /g,"_")}.doc`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const SectionLabel=({children})=>(
    <div style={{borderLeft:`4px solid ${C.primary}`,paddingLeft:12,marginBottom:12}}>
      <div style={{fontFamily:font,fontSize:15,fontWeight:700,color:C.textDark}}>{children}</div>
    </div>
  );

  const TA=({label,value,onChange,rows=4,placeholder=""})=>(
    <textarea value={value} onChange={e=>onChange(e.target.value)} rows={rows} placeholder={placeholder}
      style={{width:"100%",fontFamily:fontSerif,fontSize:13,lineHeight:1.8,padding:14,border:`1.5px solid ${C.border}`,borderRadius:8,resize:"vertical",color:"#1a0007",background:"#fffef8",boxSizing:"border-box",boxShadow:"inset 0 1px 3px rgba(0,0,0,0.06)"}}/>
  );

  return(
    <div style={{display:"grid",gridTemplateColumns:"1fr 380px",gap:0,height:"calc(100vh - 130px)"}}>
      {/* ── Panel izquierdo: redacción ── */}
      <div style={{overflowY:"auto",padding:"20px 24px",background:C.bg}}>
        {/* Header del informe */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <div style={{fontFamily:font,fontSize:20,fontWeight:700,color:C.primary}}>Informe Neuropsicológico{patient.name?" · "+patient.name:""}</div>
          </div>
          <button onClick={exportWord} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 20px",borderRadius:9,background:C.primary,color:"#fff",border:"none",fontFamily:font,fontWeight:700,cursor:"pointer",fontSize:13}}>
            📄 Exportar Word
          </button>
        </div>

        {/* LOGOS */}
        <div style={S.card}>
          <SectionLabel>Logos institucionales del informe</SectionLabel>
          <p style={{fontFamily:font,fontSize:12,color:C.textLight,marginBottom:16}}>Subí los logos que aparecerán en el encabezado del informe Word. Se guardan en este navegador.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
            {[{num:1,logo:logo1,label:"Logo principal (izquierda)"},{num:2,logo:logo2,label:"Logo secundario (derecha)"}].map(({num,logo,label})=>(
              <div key={num}>
                <div style={{fontFamily:font,fontSize:12,fontWeight:700,color:C.textMid,marginBottom:8}}>{label}</div>
                <label style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",borderRadius:8,border:`1.5px dashed ${C.border}`,cursor:"pointer",background:"#fff",fontFamily:font,fontSize:12,color:C.textLight}}>
                  <span style={{fontSize:16}}>🖼</span> Subir logo
                  <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleLogo(e,num)}/>
                </label>
                {logo&&(
                  <div style={{marginTop:8,display:"flex",alignItems:"center",gap:10}}>
                    <img src={logo} style={{height:50,maxWidth:160,objectFit:"contain",border:`1px solid ${C.border}`,borderRadius:6,padding:4,background:"#fff"}}/>
                    <button onClick={()=>{if(num===1){setLogo1(null);window.storage.delete("logo1_b64").catch(()=>{});}else{setLogo2(null);window.storage.delete("logo2_b64").catch(()=>{});}}} style={{background:"none",border:"none",color:C.danger,cursor:"pointer",fontFamily:font,fontSize:12}}>✕ Quitar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* DATOS DE LA EVALUACIÓN */}
        <div style={S.card}>
          <SectionLabel>Datos de la evaluación</SectionLabel>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
            {[["evaluador","Evaluado por","Nombre del profesional"],["derivadoPor","Derivado por","Ej: Iniciativa propia"],["dni","DNI","Número de documento"],["ocupacion","Ocupación","Ej: Estudiante"],["procedencia","Procedencia","Ciudad o localidad"],["dominancia","Dominancia manual","Diestro / Zurdo"]].map(([k,lbl,ph])=>(
              <div key={k} style={S.formGroup}>
                <label style={{...S.label,textTransform:"uppercase",letterSpacing:"0.05em",fontSize:10}}>{lbl}</label>
                <input style={S.input} value={evalMeta[k]} onChange={e=>upMeta(k,e.target.value)} placeholder={ph}/>
              </div>
            ))}
          </div>
        </div>

        {/* CONDUCTA */}
        <div style={S.card}>
          <SectionLabel>Descripción de la conducta durante la evaluación</SectionLabel>
          <TA value={conducta} onChange={setConducta} rows={5} placeholder="A lo largo de la sesión, el/la paciente..."/>
        </div>

        {/* RESULTADOS */}
        <div style={S.card}>
          <SectionLabel>Resultados</SectionLabel>
          <p style={{fontFamily:font,fontSize:11,color:C.textLight,marginBottom:10}}>Redactá los hallazgos por dominio cognitivo. La tabla Z y el perfil se agregan automáticamente al exportar.</p>
          <TA value={resultados} onChange={setResultados} rows={10} placeholder="Atención y velocidad de procesamiento:&#10;Memoria verbal:&#10;..."/>
        </div>

        {/* CONCLUSIONES */}
        <div style={S.card}>
          <SectionLabel>Conclusiones</SectionLabel>
          <TA value={conclusiones} onChange={setConclusiones} rows={5} placeholder="En síntesis, los resultados de la evaluación indican..."/>
        </div>

        {/* RECOMENDACIONES */}
        <div style={S.card}>
          <SectionLabel>Recomendaciones</SectionLabel>
          <TA value={recomendaciones} onChange={setRecomendaciones} rows={5} placeholder="Se sugiere..."/>
        </div>

        {/* Vista previa tabla Z */}
        {Object.keys(adminTests||{}).some(k=>adminTests[k])&&(
          <div style={S.card}>
            <SectionLabel>Vista previa — Tabla de puntajes Z</SectionLabel>
            <p style={{fontFamily:font,fontSize:11,color:C.textLight,marginBottom:10}}>Se incluye automáticamente en el Word exportado.</p>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontFamily:font,fontSize:12}}>
                <thead>
                  <tr style={{background:C.primary,color:"#fff"}}>
                    <th style={{padding:"7px 10px",textAlign:"left"}}>Test / Variable</th>
                    <th style={{padding:"7px 8px",textAlign:"center",width:60}}>PB</th>
                    <th style={{padding:"7px 8px",textAlign:"center",width:50}}>Z</th>
                    <th style={{padding:"7px 10px",textAlign:"left"}}>Clasificación</th>
                  </tr>
                </thead>
                <tbody>
                  {buildZRows(results,adminTests).map((r,i)=>(
                    <tr key={i} style={{background:i%2===0?"#fff":"#fdf6f7"}}>
                      <td style={{padding:"5px 10px",color:C.textDark}}>{r.label}</td>
                      <td style={{padding:"5px 8px",textAlign:"center",color:C.textMid}}>{r.pb}</td>
                      <td style={{padding:"5px 8px",textAlign:"center",fontWeight:700,color:parseFloat(r.z)<=-1?C.danger:parseFloat(r.z)>=1?C.success:C.textMid}}>{r.z}</td>
                      <td style={{padding:"5px 10px"}}><span style={{...S.badge(parseFloat(r.z)<=-1?C.danger:parseFloat(r.z)>=1?C.success:C.textLight),fontSize:10}}>{r.cls}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Panel derecho: perfil Z ── */}
      <div style={{background:"#f8f9fa",borderLeft:`1px solid ${C.border}`,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <PerfilZPanel results={results} patient={patient}/>
      </div>
    </div>
  );
}



function AIReportGenerator({results,patient}){
  const [report,setReport]=useState("");
  const [loading,setLoading]=useState(false);
  const [copied,setCopied]=useState(false);
  const [style,setStyle]=useState("formal");

  async function generateReport(){
    setLoading(true); setReport("");
    const lines=[];
    const adm=adminTests; // solo pruebas marcadas como administradas
    lines.push(`Paciente: ${patient.name||"—"}, ${patient.age||"—"} años, sexo: ${patient.sex||"—"}, escolaridad: ${patient.education||"—"} (${patient.educYears||"?"} años).`);
    lines.push(`Motivo de consulta: ${patient.reason||"—"}. Fecha: ${patient.date||"—"}.`);
    const admList=Object.keys(adm).filter(k=>adm[k]);
    if(admList.length>0) lines.push(`Pruebas administradas: ${admList.join(", ")}.`);
    if(results.briefa&&adm.briefa){const{BRI,MI,GEC}=results.briefa;lines.push(`BRIEF-A: BRI T=${BRI.t}(${BRI.label}), MI T=${MI.t}(${MI.label}), GEC T=${GEC.t}(${GEC.label}).`);}
    if(results.moca&&adm.moca) lines.push(`MoCA: ${results.moca.total}/30 (ajust: ${results.moca.adjusted}) → ${results.moca.label}.`);
    if(results.wais&&adm.waisiv){const idxStr=WAIS_INDEXES.filter(i=>results.wais[i.key]&&parseInt(results.wais[i.key])>0).map(i=>`${i.short}=${results.wais[i.key]}(${classifyWAIS(results.wais[i.key]).label},Pc${waisPct(results.wais[i.key])})`).join(", ");if(idxStr)lines.push(`WAIS-IV: ${idxStr}.`);}
    if(results.wisc5&&adm.wiscv){const idxStr=WISC5_INDEXES.filter(i=>i.type==="principal"&&results.wisc5.indexes[i.key]).map(i=>{const r=results.wisc5.indexes[i.key];return`${i.abbr}=${r.val}(${r&&r.cls?r.cls.label:"—"},P${r.pct})`;}).join(", ");if(idxStr)lines.push(`WISC-V: ${idxStr}.`);}
    if(results.bads&&adm.bads) lines.push(`BADS: total=${results.bads.total}/24 (Z=${results.bads.z}) → ${results.bads.label}.`);
    if(results.rey&&adm.rey){const r=results.rey;lines.push(`Figura Compleja de Rey: Copia=${r.copia}/36 (P${r.copiaPC}), Memoria=${r.memoria}/36 (P${r.memoriaPC}), Retención=${r.retencion}%.`);}
    if(results.papdi&&adm.papdi) lines.push(`PAPDI: ${results.papdi.score}/30 (Z=${results.papdi.z}) → ${results.papdi.label}.`);
    if(results.bnt&&adm.bnt) lines.push(`BNT-${results.bnt.mode}: ${results.bnt.score} → ${results.bnt.label}.`);
    if(results.tmt&&adm.tmtfv){const t=results.tmt;if(t.timeA)lines.push(`TMT-A: ${t.timeA}s (Z=${t.zA}) → ${t.classA.label}. TMT-B: ${t.timeB}s (Z=${t.zB}) → ${t.classB.label}. B-A Z=${t.zBminusA}(${t.classDiff.label}).`);}
    if(results.fv&&adm.tmtfv){const f=results.fv;if(f.semantic)lines.push(`FV Semántica: ${f.semantic} palabras (Z=${f.zSem}) → ${f.clsSem.label}.`);if(f.phonologic)lines.push(`FV Fonológica: ${f.phonologic} palabras (Z=${f.zFon}) → ${f.clsFon.label}.`);}
    if(results.mbi&&adm.mbi){const m=results.mbi;lines.push(`MBI: AE=${m.sumAE}/54(${m.clsAE.level}), D=${m.sumD}/30(${m.clsD.level}), RP=${m.sumRP}/48(${m.clsRP.level}). ${m.burnout?"BURNOUT PRESENTE":"Sin burnout"}.`);}
    if(results.snap&&adm.snap) lines.push(`SNAP-IV: DA=${results.snap.sumDA}(M=${results.snap.meanDA},${results.snap.daPos?"positivo":"negativo"}), HI=${results.snap.sumHI}(M=${results.snap.meanHI},${results.snap.hiPos?"positivo":"negativo"}) → ${results.snap.subtype}.`);
    if(results.stroop&&adm.stroop){const s=results.stroop;lines.push(`Stroop: P T=${s.tP}(${s.rawP} ítems), C T=${s.tC}(${s.rawC}), PC T=${s.tPC}(${s.rawPC}), Interferencia T=${s.tInterf}(${s.interference}).`);}
    if(results.ravlt&&adm.ravlt){const rv=results.ravlt;if(rv.isAdult&&rv.adultNorm){const a5=parseInt(rv.scores.A5)||0;const a7=parseInt(rv.scores.A7)||0;lines.push(`RAVLT (grupo ${rv.adultGroup}): A1=${rv.scores.A1||"—"}, A5=${a5}, A7=${a7}. Pérdida A5→A6: ${a5-(parseInt(rv.scores.A6)||0)}.`);}}
    if(results.tavec&&adm.tavec){const tv=results.tavec;const measures=["A1","A5","total","rlld","recog"].filter(k=>tv.scores[k]);lines.push(`TAVEC (grupo ${tv.ag}): ${measures.map(k=>`${k}=${tv.scores[k]}`).join(", ")}.`);}
    if(results.wms3&&adm.wms3){const filled=WMS3_INDEXES.filter(i=>results.wms3[i.key]);lines.push(`WMS-III: ${filled.map(i=>`${i.short}=${results.wms3[i.key]}(${classifyWMS(results.wms3[i.key])?.label})`).join(", ")}.`);}
    if(results.wcst&&adm.wcst){const ag=results.wcst.ageGroup;const n=ag?WCST_NORMS[ag]:null;const sc=results.wcst.scores;const parts=[];if(sc.categories!==undefined)parts.push(`Cat=${sc.categories}`+(n?`(Z=${zScore(parseFloat(sc.categories),n.categories.m,n.categories.s)>0?"+":""}${zScore(parseFloat(sc.categories),n.categories.m,n.categories.s)})`:""));if(sc.totalErrors!==undefined)parts.push(`ErrTot=${sc.totalErrors}`+(n?`(Z=${zScore(parseFloat(sc.totalErrors),n.totalErrors.m,n.totalErrors.s)>0?"+":""}${zScore(parseFloat(sc.totalErrors),n.totalErrors.m,n.totalErrors.s)})`:""));if(sc.persevErrors!==undefined)parts.push(`ErrPersev=${sc.persevErrors}`);lines.push(`WCST Abreviado (grupo ${ag}): ${parts.join(", ")}.`);}
    if(results.ifs&&adm.ifs){lines.push(`IFS: Total=${results.ifs.total.toFixed(1)}/30 → ${results.ifs.below?"POR DEBAJO del punto de corte (< 25) — disfunción ejecutiva":"dentro del rango normal"}. Índice MT=${results.ifs.wm}/10.`);}
    if(results.scl90&&adm.scl90){const sigs=Object.entries(SCL90_DIMS).filter(([dk])=>results.scl90.dims[dk]?.cls?.label==="Clínicamente significativo"||results.scl90.dims[dk]?.cls?.label==="Muy elevado").map(([dk,dd])=>`${dd.label} (T=${results.scl90.dims[dk].t})`).join(", ");lines.push(`SCL-90-R: IGS T=${results.scl90.igsT}(${results.scl90.igsCls?.label}). PST=${results.scl90.PST}/90. Escalas significativas (T≥63): ${sigs||"ninguna"}.`);}
    if(results.srs&&adm.srs) lines.push(`SRS: T=${results.srs.t} → ${results.srs.cls?results.srs.cls.label:"—"}. ${results.srs.cls?results.srs.cls.desc:""}`);
    if(results.wurs&&adm.wurs) lines.push(`WURS-25: puntaje=${results.wurs.score25}, Z=${results.wurs.z25}, P${results.wurs.pct25}. Corte Scandar: ${results.wurs.cutScandar?"≥36.5 sugestivo TDAH infantil":"por debajo del corte"}.`);
    if(results.asrs&&adm.asrs) lines.push(`ASRS: Total=${results.asrs.scoreT}/72 (P${results.asrs.pctT}), Inatención=${results.asrs.scoreI} (P${results.asrs.pctI}), Hiperactividad=${results.asrs.scoreH} (P${results.asrs.pctH}).`);
    if(results.caras&&adm.caras) lines.push(`CARAS-R: A-E=${results.caras.AE} (Z=${results.caras.zAE}, En${results.caras.eneatipo}) → ${results.caras.cls?results.caras.cls.label:"—"}.`);
    if(results.neuropsi&&adm.neuropsi) lines.push(`NEUROPSI: Total=${results.neuropsi.total}/122 (${Math.round(results.neuropsi.total/1.22)}%). Dominios: ${Object.entries(results.neuropsi.domains).map(([d,{tot,max}])=>`${d}=${tot}/${max}`).join(", ")}.`);
    if(results.reloj&&adm.reloj){const r=results.reloj;const parts=[];if(r.tro!==null)parts.push(`TRO=${r.tro}/10 (${r.tro<=6?"⚠ positivo":"normal"})`);if(r.trc!==null)parts.push(`TRC=${r.trc}/10 (${r.trc<=8?"⚠ positivo":"normal"})`);if(parts.length)lines.push(`Test del Reloj: ${parts.join(", ")}.`);}
    if(results.wcst){const ag=results.wcst.ageGroup;const n=ag?WCST_NORMS[ag]:null;const sc=results.wcst.scores;const parts=[];if(sc.categories!==undefined)parts.push(`Cat=${sc.categories}`+(n?`(Z=${zScore(parseFloat(sc.categories),n.categories.m,n.categories.s)>0?"+":""}${zScore(parseFloat(sc.categories),n.categories.m,n.categories.s)})`:""));if(sc.totalErrors!==undefined)parts.push(`ErrTot=${sc.totalErrors}`+(n?`(Z=${zScore(parseFloat(sc.totalErrors),n.totalErrors.m,n.totalErrors.s)>0?"+":""}${zScore(parseFloat(sc.totalErrors),n.totalErrors.m,n.totalErrors.s)})`:""));if(sc.persevErrors!==undefined)parts.push(`ErrPersev=${sc.persevErrors}`);lines.push(`WCST Abreviado (grupo ${ag}): ${parts.join(", ")}.`);}
    if(results.ifs){lines.push(`IFS: Total=${results.ifs.total.toFixed(1)}/30 → ${results.ifs.below?"POR DEBAJO del punto de corte (< 25) — disfunción ejecutiva":"dentro del rango normal"}. Índice MT=${results.ifs.wm}/10.`);}

    const stylePrompt=style==="formal"?"Usá un estilo técnico-clínico formal, propio de un informe neuropsicológico profesional en Argentina.":"Usá un estilo accesible que pueda leer el paciente o su familia.";

    const bibliografiaMarco = `
MARCO TEÓRICO Y BIBLIOGRAFÍA DE REFERENCIA (usá estos principios al redactar):

FUNCIONES EJECUTIVAS (FE):
- Las FE son un sistema supramodal de procesamiento múltiple que incluye: velocidad de procesamiento, memoria de trabajo (MT), inhibición, flexibilidad cognitiva, planificación y toma de decisiones (Tirapu-Ustárroz & Luna-Lario, en Neuropsicología de las Funciones Ejecutivas).
- El modelo integrador de Tirapu distingue: (1) acciones rutinarias mediadas por la MT y el SAS, y (2) acciones novedosas que activan el Sistema Atencional Supervisor (SAS) de Norman & Shallice y el marcador somático de Damasio.
- El Stroop evalúa inhibición (control de la interferencia) y velocidad de procesamiento; el WCST evalúa flexibilidad cognitiva y set-shifting; el TMT-A evalúa velocidad de procesamiento y TMT-B evalúa atención alternante; el BADS evalúa planificación ecológica (validez de vida real).
- El IFS (INECO Frontal Screening) es un screening específico de disfunción frontal (corte ≥25).
- Importante: Puede existir disociación entre rendimiento conservado en pruebas estructuradas (con consignas externas) y dificultades ejecutivas en la vida cotidiana (menor validez ecológica de los tests formales). El BRIEF-A captura este funcionamiento cotidiano.

TDAH EN ADULTOS (si aplica):
- El perfil cognitivo del TDAH se caracteriza por puntuaciones dentro del rango normal pero significativamente menores que controles, especialmente en: IMT (Índice de Memoria de Trabajo), IVP (Índice de Velocidad de Procesamiento), funciones ejecutivas y habilidades académicas (Robles Bermejo, Anales de Pediatría, 2023).
- Los varones tienden a presentar más síntomas externalizantes; las mujeres pueden estar infradiagnosticadas.
- El WURS-25 retrospectivo y el ASRS v1.1 son escalas validadas en Argentina para TDAH (Scandar, 2021).
- La discrepancia entre el desempeño formal (dentro de norma con estructura externa) y las dificultades en vida cotidiana (BRIEF-A elevado en procesos metacognitivos) es un hallazgo consistente y diagnósticamente relevante.

NEUROPSICOLOGÍA CLÍNICA:
- La evaluación neuropsicológica obtiene un perfil de capacidades (puntos fuertes y débiles) que debe ser compatible con la alteración o el trastorno detectado (Ardila, 2012; Manga & Ramos, 1999).
- Integrar siempre: historia clínica evolutiva + pruebas formales + cuestionarios conductuales + observación durante la evaluación.
- Mencionar cuando corresponda la validez ecológica: la situación de evaluación provee estructura externa que puede enmascarar dificultades reales (Tirapu-Ustárroz; Robles Bermejo, 2023).

ESTRUCTURA DEL INFORME (seguí este modelo):
El informe debe incluir, en este orden:
1. PERFIL COGNITIVO Y/O DIAGNÓSTICO NEUROPSICOLÓGICO PRESUNTIVO: párrafo integrador inicial con el resumen del funcionamiento global.
2. Por cada DOMINIO cognitivo evaluado, redactar un párrafo que: (a) describa el rendimiento observado, (b) interprete clínicamente qué significa, (c) integre varias pruebas del mismo dominio cuando corresponda.
   Dominios a mencionar si hay datos: Inteligencia General, Atención y Velocidad de Procesamiento, Memoria Verbal, Memoria no Verbal y Visopercepción, Lenguaje, Funciones Ejecutivas (pruebas formales), Funcionamiento Ejecutivo Cotidiano (cuestionarios conductuales como BRIEF-A), Escalas Conductuales y del Estado de Ánimo.
3. OBSERVACIONES AL MOMENTO DE LA VALORACIÓN: tabla o párrafo sobre presentación, orientación, lenguaje espontáneo, pensamiento, conducta durante la evaluación.
4. IMPRESIÓN DIAGNÓSTICA: párrafo en cursiva o destacado con el diagnóstico o hipótesis diagnóstica presuntiva.
5. SUGERENCIAS: lista de 3-5 recomendaciones concretas, específicas y accionables.

ESTILO: redactá en español rioplatense, con terminología técnica neuropsicológica. Texto fluido, párrafos bien desarrollados, sin bullets ni markdown. Mencionar valores numéricos solo cuando aportan información clínica significativa.`;

    const prompt=`Sos un neuropsicólogo clínico experto argentino. ${stylePrompt}

${bibliografiaMarco}

DATOS DEL PACIENTE Y RESULTADOS DE LAS PRUEBAS:
${lines.join("\n")}

Redactá el PERFIL COGNITIVO Y/O DIAGNÓSTICO NEUROPSICOLÓGICO PRESUNTIVO del informe completo, siguiendo la estructura y el marco teórico indicados. Escribí solo el cuerpo narrativo del informe (desde el perfil cognitivo hasta las sugerencias inclusive). Sin markdown, solo texto plano con párrafos separados por línea en blanco.`;
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1500,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      setReport(data.content?.map(b=>b.text||"").join("")||"Error al generar.");
    }catch{setReport("Error de conexión.");}
    setLoading(false);
  }

  function copyReport(){navigator.clipboard.writeText(`INFORME NEUROPSICOLÓGICO\nPaciente: ${patient.name} | Fecha: ${patient.date}\n${"─".repeat(50)}\n\n`+report);setCopied(true);setTimeout(()=>setCopied(false),2500);}

  return(
    <div style={{...S.card,border:`2px solid ${C.accent}40`}}>
      <h3 style={S.sectionTitle}>🤖 Generador de Informe Narrativo con IA</h3>
      <div style={{display:"flex",gap:12,alignItems:"flex-end",marginBottom:16,flexWrap:"wrap"}}>
        <div><label style={S.label}>Estilo de redacción</label><select style={{...S.select,width:"auto"}} value={style} onChange={e=>setStyle(e.target.value)}><option value="formal">Técnico-clínico (expediente)</option><option value="accessible">Accesible (paciente/familia)</option></select></div>
        <button style={S.btn("primary")} onClick={generateReport} disabled={loading}>{loading?"⏳ Generando...":"✨ Generar informe"}</button>
      </div>
      {loading&&<div style={{textAlign:"center",padding:"32px 0",color:C.textLight,fontFamily:font}}><div style={{fontSize:28}}>🧠</div><p>Analizando resultados...</p></div>}
      {report&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontWeight:700,fontFamily:font,fontSize:14,color:C.primary}}>Borrador generado</span>
            <button style={S.btn(copied?"success":null)} onClick={copyReport}>{copied?"✓ Copiado":"📋 Copiar"}</button>
          </div>
          <textarea style={{width:"100%",minHeight:380,padding:16,border:`1px solid ${C.border}`,borderRadius:10,fontFamily:font,fontSize:13,lineHeight:1.7,color:C.textDark,background:"#fdf6f7",resize:"vertical",boxSizing:"border-box"}} value={report} onChange={e=>setReport(e.target.value)}/>
          <p style={{margin:"8px 0 0",fontSize:11,fontFamily:font,color:C.textLight,fontStyle:"italic"}}>⚠ Borrador auxiliar IA. Revisar, validar y firmar antes de uso clínico.</p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── RADAR CHART ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function RadarChart({results}){
  const axes=[];
  const invert=t=>t?Math.max(0,Math.min(100,100-((t-30)/50)*100)):50;
  if(results.briefa){const{BRI,MI}=results.briefa;axes.push({label:"BRI",value:invert(BRI.t),color:C.primary,raw:`T=${BRI.t}`});axes.push({label:"MI",value:invert(MI.t),color:C.dark,raw:`T=${MI.t}`});}
  if(results.wais?.cit) axes.push({label:"CIT",value:Math.min(100,Math.max(0,((parseInt(results.wais.cit)-40)/120)*100)),color:"#1d4ed8",raw:`CIT=${results.wais.cit}`});
  if(results.wais?.icv) axes.push({label:"ICV",value:Math.min(100,Math.max(0,((parseInt(results.wais.icv)-40)/120)*100)),color:C.primary,raw:`ICV=${results.wais.icv}`});
  if(results.wais?.irp) axes.push({label:"IRP",value:Math.min(100,Math.max(0,((parseInt(results.wais.irp)-40)/120)*100)),color:"#6d28d9",raw:`IRP=${results.wais.irp}`});
  if(results.wais?.imt) axes.push({label:"IMT",value:Math.min(100,Math.max(0,((parseInt(results.wais.imt)-40)/120)*100)),color:C.success,raw:`IMT=${results.wais.imt}`});
  if(results.wais?.ivp) axes.push({label:"IVP",value:Math.min(100,Math.max(0,((parseInt(results.wais.ivp)-40)/120)*100)),color:"#0891b2",raw:`IVP=${results.wais.ivp}`});
  if(results.bads) axes.push({label:"BADS",value:(results.bads.total/24)*100,color:"#2d7a4f",raw:`${results.bads.total}/24`});
  if(results.tmt?.zA!==null&&results.tmt?.zA!==undefined) axes.push({label:"TMT-B",value:Math.max(0,Math.min(100,((results.tmt.zB+3)/5)*100)),color:"#0891b2",raw:`Z=${results.tmt.zB}`});
  if(results.stroop?.tPC) axes.push({label:"Stroop-PC",value:Math.max(0,Math.min(100,(results.stroop.tPC-20)/60*100)),color:"#6d28d9",raw:`T=${results.stroop.tPC}`});
  if(results.ravlt?.adultNorm&&results.ravlt?.scores?.A5){const n=results.ravlt.adultNorm.A5;const z=zScore(parseInt(results.ravlt.scores.A5),n.m,n.s);axes.push({label:"RAVLT-A5",value:Math.max(0,Math.min(100,((z||0)+3)/5*100)),color:"#b45309",raw:`A5=${results.ravlt.scores.A5}`});}
  if(results.tavec?.scores?.rlld&&results.tavec?.norm?.rlld){const n=results.tavec.norm.rlld;const z=zScore(parseInt(results.tavec.scores.rlld),n.m,n.s);axes.push({label:"TAVEC-LP",value:Math.max(0,Math.min(100,((z||0)+3)/5*100)),color:"#0e7490",raw:`RLLD=${results.tavec.scores.rlld}`});}
  if(results.wms3){const mg=parseInt(results.wms3.mg);if(mg) axes.push({label:"WMS-MG",value:Math.max(0,Math.min(100,(mg-40)/120*100)),color:"#7c3aed",raw:`MG=${mg}`});}
  if(results.fv?.zSem!==null&&results.fv?.zSem!==undefined) axes.push({label:"FV-Sem",value:Math.max(0,Math.min(100,((results.fv.zSem+3)/5)*100)),color:"#7c3aed",raw:`Z=${results.fv.zSem}`});
  if(axes.length<3)return null;
  const cx=220,cy=210,r=155,n=axes.length,step=(2*Math.PI)/n,start=-Math.PI/2;
  const pt=(i,rad)=>({x:cx+rad*Math.cos(start+i*step),y:cy+rad*Math.sin(start+i*step)});
  const rings=[25,50,75,100];
  const pts=axes.map((_,i)=>pt(i,(_.value/100)*r));
  const path=pts.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")+" Z";
  return(
    <div style={{...S.card,marginBottom:20}}>
      <h3 style={S.sectionTitle}>📡 Perfil Cognitivo Global</h3>
      <div style={{display:"flex",gap:24,flexWrap:"wrap"}}>
        <svg width={440} height={420} style={{flexShrink:0}}>
          {rings.map(pct=><polygon key={pct} points={axes.map((_,i)=>{const p=pt(i,(pct/100)*r);return`${p.x.toFixed(1)},${p.y.toFixed(1)}`;}).join(" ")} fill="none" stroke={C.border} strokeWidth={pct===100?1.5:0.8} strokeDasharray={pct<100?"4 3":"none"}/>)}
          <polygon points={axes.map((_,i)=>{const p=pt(i,0.66*r);return`${p.x.toFixed(1)},${p.y.toFixed(1)}`;}).join(" ")} fill={`${C.warning}15`} stroke={C.warning} strokeWidth={1} strokeDasharray="5 3"/>
          {axes.map((_,i)=><line key={i} x1={cx} y1={cy} x2={(cx+r*Math.cos(start+i*step)).toFixed(1)} y2={(cy+r*Math.sin(start+i*step)).toFixed(1)} stroke={C.border} strokeWidth={1}/>)}
          <path d={path} fill={`${C.primary}25`} stroke={C.primary} strokeWidth={2.5} strokeLinejoin="round"/>
          {pts.map((p,i)=><circle key={i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={5} fill={axes[i].color} stroke="white" strokeWidth={1.5}/>)}
          {axes.map((a,i)=>{const p=pt(i,r+26);const anchor=p.x<cx-5?"end":p.x>cx+5?"start":"middle";return(<g key={i}><text x={p.x.toFixed(1)} y={p.y.toFixed(1)} fontSize={12} fontWeight={700} fill={a.color} fontFamily={font} textAnchor={anchor} dominantBaseline="middle">{a.label}</text><text x={p.x.toFixed(1)} y={(p.y+14).toFixed(1)} fontSize={10} fill={C.textLight} fontFamily={font} textAnchor={anchor} dominantBaseline="middle">{a.raw}</text></g>);})}
        </svg>
        <div style={{flex:1,minWidth:160}}>
          <p style={{margin:"0 0 12px",fontWeight:700,fontFamily:font,fontSize:14,color:C.primary}}>Leyenda</p>
          {axes.map(a=><div key={a.label} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><div style={{width:12,height:12,borderRadius:"50%",background:a.color}}/><div><span style={{fontWeight:700,fontFamily:font,fontSize:13}}>{a.label}</span><span style={{fontFamily:font,fontSize:12,color:C.textLight,marginLeft:6}}>{a.raw}</span></div><div style={{marginLeft:"auto",width:50,background:C.border,borderRadius:4,height:6,overflow:"hidden"}}><div style={{width:`${a.value}%`,height:"100%",background:a.color,borderRadius:4}}/></div></div>)}
          <div style={{marginTop:16,padding:"10px 14px",background:`${C.warning}15`,borderRadius:8,border:`1px solid ${C.warning}30`}}><p style={{margin:0,fontSize:11,fontFamily:font,color:C.warning}}>La línea punteada marca el umbral ~Pc16. Valores por debajo sugieren dificultades clínicas.</p></div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── BRIEF-A FORM (simplified entry) ─────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function BriefAForm({briefScores,setBriefScores,patient}){
  const up=(k,v)=>setBriefScores(s=>({...s,[k]:parseInt(v)||""}));
  const age=parseInt(patient.age)||50;
  const ag=getAgeGroup(age,["18-29","30-39","40-49","50-59","60-65","66-80"])||"50-59";
  return(
    <div style={S.card}>
      <h3 style={S.sectionTitle}>🧠 BRIEF-A — Inventario de Evaluación del Comportamiento de las FE</h3>
      <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Roth et al. (2005). Escala Likert 1-3 por ítem. Grupo edad: {ag}.</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
        {BRIEF_SCALES.map(sc=>{
          const val=briefScores[sc.key]||"";
          const t=val?lookupNearest(BRIEF_NORMS[sc.key]?.[ag],val):null;
          const cls=t?classifyT(t):null;
          return(
            <div key={sc.key} style={{border:`1px solid ${C.border}`,borderRadius:8,padding:12}}>
              <label style={{...S.label,marginBottom:4}}>{sc.label} ({sc.items} ítems)</label>
              <p style={{margin:"0 0 6px",fontSize:11,color:C.textLight,fontFamily:font}}>Índice: {sc.index} · Min: {sc.items} · Max: {sc.items*3}</p>
              <input type="number" min={sc.items} max={sc.items*3} style={S.input} value={val} onChange={e=>up(sc.key,e.target.value)} placeholder={`${sc.items}–${sc.items*3}`}/>
              {t&&<div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}><span style={{fontFamily:font,fontWeight:700,fontSize:14,color:cls?cls.color:C.textLight}}>T={t}</span><span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span></div>}
              {t&&<TBar t={t}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── MoCA FORM ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function MoCAForm({mocaScores,setMocaScores,patient}){
  const up=(k,v)=>setMocaScores(s=>({...s,[k]:v}));
  const total=MOCA_DOMAINS.reduce((s,d)=>s+(parseInt(mocaScores[d.key])||0),0);
  const educYears=parseInt(patient.educYears)||12;
  const adjusted=educYears<12?Math.min(total+1,30):total;
  const cls=adjusted>=26?{label:"Normal",color:C.success}:adjusted>=21?{label:"DCL",color:C.warning}:{label:"Posible demencia",color:C.danger};
  return(
    <div style={S.card}>
      <h3 style={S.sectionTitle}>🔬 MoCA — Evaluación Cognitiva de Montreal</h3>
      <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 16px"}}>Nasreddine et al. (2005). Punto de corte: ≥26 normal. +1 punto si escolaridad {'<'}12 años.</p>
      <div style={S.grid2}>
        {MOCA_DOMAINS.map(d=>(
          <div key={d.key} style={S.formGroup}>
            <label style={S.label}>{d.label} (máx. {d.maxScore})</label>
            <p style={{margin:"0 0 6px",fontSize:12,color:C.textLight,fontFamily:font}}>{d.desc}</p>
            <input type="number" min={0} max={d.maxScore} style={S.input} value={mocaScores[d.key]||""} onChange={e=>up(d.key,Math.min(parseInt(e.target.value)||0,d.maxScore))}/>
          </div>
        ))}
      </div>
      <div style={{background:`${cls?cls.color:"transparent"}15`,border:`2px solid ${cls?cls.color+"40":C.border}`,borderRadius:10,padding:"16px 20px",display:"flex",gap:24,alignItems:"center"}}>
        <div style={{textAlign:"center"}}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>PUNTAJE BRUTO</div><div style={{fontSize:40,fontWeight:800,fontFamily:font,color:cls?cls.color:C.textLight}}>{total}/30</div></div>
        {educYears<12&&<div style={{textAlign:"center"}}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>AJUSTADO (+1)</div><div style={{fontSize:40,fontWeight:800,fontFamily:font,color:cls?cls.color:C.textLight}}>{adjusted}/30</div></div>}
        <div><span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span></div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── MAIN APP ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// ─── WCST FORM & RESULTS ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function WCSTForm({wcstData,setWcstData,patient}){
  const up=(k,v)=>setWcstData(d=>({...d,[k]:v}));
  const age=parseInt(patient.age)||0;
  const ag=getWCSTAgeGroup(age);
  const norm=ag?WCST_NORMS[ag]:null;
  const variables=[
    {key:"categories",   label:"Categorías completadas",max:6,  inverted:false,desc:"Máx. 6 categorías (Color, Forma, Número, replicados)"},
    {key:"totalErrors",  label:"Total de Errores",      max:64, inverted:true, desc:"Total respuestas incorrectas (64 cartas)"},
    {key:"persevResponses",label:"Respuestas Perseverativas",max:64,inverted:true,desc:"Seguir criterio anterior aunque ya no sea correcto"},
    {key:"persevErrors", label:"Errores Perseverativos",max:64, inverted:true, desc:"Errores específicamente por perseveración"},
    {key:"nonpersevErrors",label:"Errores No Perseverativos",max:64,inverted:true,desc:"Errores por otra causa (no perseveración)"},
  ];
  return(
    <div style={S.card}>
      <h3 style={S.sectionTitle}>🃏 WCST Abreviado — Wisconsin Card Sorting Test</h3>
      <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Axelrod, Jiron & Henry (1993) — versión 64 cartas. Baremos por década (n=20/grupo).</p>
      {ag?(
        <div style={{background:`${C.success}12`,border:`1px solid ${C.success}50`,borderRadius:8,padding:"10px 16px",marginBottom:16}}>
          <span style={{fontFamily:font,fontSize:13,fontWeight:700,color:C.success}}>✓ Grupo: {ag} años · </span>
          <span style={{fontFamily:font,fontSize:13,color:C.textDark}}>Normas de Axelrod et al. (1993)</span>
        </div>
      ):(
        <div style={{background:`${C.warning}12`,border:`1px solid ${C.warning}50`,borderRadius:8,padding:"10px 16px",marginBottom:16}}>
          <span style={{fontFamily:font,fontSize:13,color:C.warning}}>⚠ Ingresá la edad del paciente para aplicar baremos normativos.</span>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        {variables.map(v=>{
          const raw=wcstData[v.key]!==""&&wcstData[v.key]!==undefined?parseFloat(wcstData[v.key]):null;
          const n=norm?norm[v.key]:null;
          const z=raw!==null&&n?zScore(raw,n.m,n.s):null;
          const cls=z!==null?classifyZ(z,v.inverted):null;
          return(
            <div key={v.key} style={{border:`2px solid ${cls?cls.color+"50":C.border}`,borderRadius:12,padding:16,background:cls?`${cls.color}05`:"#fff"}}>
              <label style={{...S.label,marginBottom:4}}>{v.label}</label>
              <p style={{margin:"0 0 8px",fontSize:11,color:C.textLight,fontFamily:font}}>{v.desc}</p>
              <input type="number" min={0} max={v.max} style={S.input} value={wcstData[v.key]||""} onChange={e=>up(v.key,e.target.value)} placeholder={`0–${v.max}`}/>
              {n&&raw!==null&&<p style={{margin:"4px 0 0",fontSize:11,color:C.textLight,fontFamily:font}}>Norma: M={n.m} DE={n.s} · {v.inverted?"↓ menor es mejor":"↑ mayor es mejor"}</p>}
              {z!==null&&cls&&(
                <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}>
                  <span style={{fontFamily:font,fontWeight:700,fontSize:13,color:cls?cls.color:C.textLight}}>Z={z>0?"+":""}{z}</span>
                  <span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{background:`${C.primary}08`,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 18px",marginTop:16}}>
        <p style={{margin:0,fontSize:12,fontFamily:font,color:C.textDark}}>Versión de 64 cartas. Mide razonamiento abstracto, flexibilidad cognitiva y perseveración (lóbulo frontal). Mayor n° de Categorías y menor n° de Errores indican mejor rendimiento. Ref: Axelrod et al. (1993), <em>Clinical Neuropsychologist</em>, 7(2), 205-209.</p>
      </div>
    </div>
  );
}

function WCSTResults({r}){
  const ag=r.ageGroup;
  const norm=ag?WCST_NORMS[ag]:null;
  const items=[
    {key:"categories",label:"Categorías",inverted:false},
    {key:"totalErrors",label:"Total Errores",inverted:true},
    {key:"persevResponses",label:"Resp. Persev.",inverted:true},
    {key:"persevErrors",label:"Err. Persev.",inverted:true},
    {key:"nonpersevErrors",label:"Err. No Persev.",inverted:true},
  ];
  const hasData=items.some(i=>r.scores[i.key]!==undefined&&r.scores[i.key]!=="");
  if(!hasData)return null;
  return(
    <div style={S.card}>
      <h3 style={S.sectionTitle}>🃏 WCST Abreviado
        <span style={{fontSize:13,fontWeight:400,color:C.textLight}}>{ag?` Axelrod (1993) · Grupo ${ag} años`:" Sin grupo etario"}</span>
      </h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
        {items.map(it=>{
          const raw=r.scores[it.key]!==""&&r.scores[it.key]!==undefined?parseFloat(r.scores[it.key]):null;
          const n=norm?norm[it.key]:null;
          const z=raw!==null&&n?zScore(raw,n.m,n.s):null;
          const cls=z!==null?classifyZ(z,it.inverted):{label:"—",color:C.textLight};
          return(
            <div key={it.key} style={{...S.indexBox,border:`2px solid ${cls?cls.color+"30":C.border}`}}>
              <div style={{fontSize:11,fontWeight:700,fontFamily:font,color:C.textLight,marginBottom:4}}>{it.label}</div>
              <div style={{fontSize:30,fontWeight:800,fontFamily:font,color:cls?cls.color:C.textLight}}>{raw!==null&&raw!==undefined?raw:"—"}</div>
              {n&&<div style={{fontSize:10,color:C.textLight,fontFamily:font}}>M={n.m}</div>}
              {z!==null&&<div style={{fontSize:12,fontFamily:font,marginTop:4,color:cls?cls.color:C.textLight}}>Z={z>0?"+":""}{z}</div>}
              <div style={{marginTop:6}}><span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── IFS FORM ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function IFSForm({ifsData,setIfsData}){
  const up=(k,v)=>setIfsData(d=>({...d,[k]:v}));
  const total=IFS_SUBTESTS.reduce((s,t)=>{const v=parseFloat(ifsData[t.key]);return s+(isNaN(v)?0:v);},0);
  const wmIndex=(parseFloat(ifsData.digitsBack)||0)+(parseFloat(ifsData.spatialWT)||0);
  const allDone=IFS_SUBTESTS.every(t=>ifsData[t.key]!==undefined&&ifsData[t.key]!=="");
  const below=allDone&&total<IFS_CUTOFF;
  const ordinalSubtests=["motorSeries","conflictInstr","goNogo","monthsBack"];
  return(
    <div style={S.card}>
      <h3 style={S.sectionTitle}>🧠 IFS — INECO Frontal Screening</h3>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:-28}}><ClearBtn onClear={()=>{setIfsData({})}}/></div>
      <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Torralva et al. (2009). Screening ejecutivo frontal. Punto de corte: 25/30 (Sens. 96.2%, Esp. 91.5%).</p>

      {allDone&&(
        <div style={{background:below?`${C.danger}15`:`${C.success}15`,border:`2px solid ${below?C.danger:C.success}40`,borderRadius:10,padding:"14px 18px",marginBottom:16,display:"flex",gap:24,alignItems:"center",flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>TOTAL IFS</div>
            <div style={{fontSize:42,fontWeight:800,fontFamily:font,color:below?C.danger:C.success}}>{total.toFixed(1)}/30</div>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>ÍND. MEM. TRABAJO</div>
            <div style={{fontSize:30,fontWeight:800,fontFamily:font,color:C.primary}}>{wmIndex}/10</div>
            <div style={{fontSize:11,color:C.textLight,fontFamily:font}}>Dígitos + Corsi</div>
          </div>
          <div style={{flex:1}}>
            <span style={S.badge(below?C.danger:C.success)}>{below?"⚠ Por debajo del punto de corte (< 25) — Disfunción ejecutiva significativa":"✅ Dentro del rango normal (≥ 25)"}</span>
          </div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {IFS_SUBTESTS.map(st=>{
          const val=ifsData[st.key];
          const isOrdinal=ordinalSubtests.includes(st.key);
          return(
            <div key={st.key} style={{border:`1px solid ${C.border}`,borderRadius:10,padding:16}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:16}}>
                <div style={{flex:1}}>
                  <label style={{...S.label,marginBottom:4}}>{st.label} <span style={{fontWeight:400,color:C.textLight}}>/{st.max}</span></label>
                  <p style={{margin:"0 0 8px",fontSize:12,color:C.textLight,fontFamily:font}}>{st.desc}</p>
                </div>
                {isOrdinal?(
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                    {Array.from({length:st.max+1},(_,i)=>(
                      <button key={i} onClick={()=>up(st.key,i)} style={{width:36,height:36,borderRadius:8,border:`2px solid ${parseFloat(val)===i?C.primary:C.border}`,background:parseFloat(val)===i?C.primary:"#fff",color:parseFloat(val)===i?"white":C.textMid,fontFamily:font,fontWeight:700,cursor:"pointer",fontSize:15}}>{i}</button>
                    ))}
                  </div>
                ):(
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                    {Array.from({length:st.max+1},(_,i)=>(
                      <button key={i} onClick={()=>up(st.key,i)} style={{width:32,height:32,borderRadius:6,border:`2px solid ${parseFloat(val)===i?C.primary:C.border}`,background:parseFloat(val)===i?C.primary:"#fff",color:parseFloat(val)===i?"white":C.textMid,fontFamily:font,fontWeight:700,cursor:"pointer",fontSize:13}}>{i}</button>
                    ))}
                  </div>
                )}
              </div>
              {val!==undefined&&val!==""&&(
                <div style={{marginTop:4,display:"flex",alignItems:"center",gap:12}}>
                  <div style={{flex:1,height:6,background:C.border,borderRadius:3,overflow:"hidden"}}>
                    <div style={{width:`${(parseFloat(val)/st.max)*100}%`,height:"100%",background:C.primary,borderRadius:3}}/>
                  </div>
                  <span style={{fontFamily:font,fontWeight:700,fontSize:13,color:C.primary,minWidth:40}}>{val}/{st.max}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── WAIS-IV FORM & RESULTS ──────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function WAISForm({waisData,setWaisData,patient}){
  const up=(k,v)=>setWaisData(d=>({...d,[k]:v}));
  const ageGroup=waisData.ageGroup||"";
  const idxColors={cit:"#1d4ed8",icv:C.primary,irp:"#6d28d9",imt:C.success,ivp:"#0891b2"};
  const idxLabels={icv:"Comprensión Verbal",irp:"Razonamiento Perceptual",imt:"Memoria de Trabajo",ivp:"Velocidad de Procesamiento"};

  // Calcular PE desde bruto para cada subprueba
  const getPE=(key)=>waisBrutoToPE(waisData[key+"_b"],key,ageGroup);
  const getZ=(key)=>{const pe=getPE(key);return pe!==null?parseFloat(((pe-10)/3).toFixed(2)):null;};

  return(
    <div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>🧩 WAIS-IV — Escala Wechsler de Inteligencia para Adultos</h3>
        <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 4px"}}>
          Wechsler (2008) · Estandarización Chile: Rosas, Tenorio & Pizarro · Rango 16:0–90:11 años
        </p>
        <div style={{background:`${C.warning}12`,border:`1px solid ${C.warning}30`,borderRadius:8,padding:"8px 12px",marginBottom:16,fontSize:11,fontFamily:font,color:C.warning}}>
          ⚠ Conversión bruto → PE usando normas aproximadas. Verificar con las tablas del manual oficial.
        </div>

        {/* Paciente + grupo etario */}
        {patient.name&&(
          <div style={{background:C.bg,borderRadius:10,padding:"12px 16px",marginBottom:16,display:"flex",gap:24}}>
            <div><div style={{fontSize:10,fontWeight:700,color:C.textLight,textTransform:"uppercase",letterSpacing:"0.05em"}}>Paciente</div><div style={{fontSize:14,fontWeight:600}}>{patient.name}</div></div>
            {patient.date&&<div><div style={{fontSize:10,fontWeight:700,color:C.textLight,textTransform:"uppercase",letterSpacing:"0.05em"}}>Fecha</div><div style={{fontSize:14,fontWeight:600}}>{patient.date}</div></div>}
          </div>
        )}
        <div style={{marginBottom:20}}>
          <label style={{...S.label,textTransform:"uppercase",letterSpacing:"0.05em",fontSize:10}}>Grupo etario WAIS-IV</label>
          <select style={{...S.select,maxWidth:220}} value={ageGroup} onChange={e=>up("ageGroup",e.target.value)}>
            <option value="">— Seleccioná el grupo —</option>
            {WAIS_AGE_GROUPS.map(g=><option key={g} value={g}>{g} años</option>)}
          </select>
        </div>

        {/* ── Subpruebas: puntajes brutos → PE → Z (estilo WISC-V) ── */}
        {["icv","irp","imt","ivp"].map(idxKey=>{
          const subtests=Object.keys(WAIS_SUBTEST_IDX).filter(k=>WAIS_SUBTEST_IDX[k]===idxKey);
          return(
            <div key={idxKey} style={{marginBottom:20}}>
              <div style={{background:idxColors[idxKey],color:"white",padding:"7px 14px",borderRadius:"8px 8px 0 0",fontWeight:700,fontFamily:font,fontSize:13}}>
                {idxKey.toUpperCase()} — {idxLabels[idxKey]}
              </div>
              <div style={{border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 10px 10px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))"}}>
                {subtests.map((stKey,si)=>{
                  const bruto=waisData[stKey+"_b"];
                  const pe=ageGroup?getPE(stKey):null;
                  const z=ageGroup?getZ(stKey):null;
                  const cls=classifyWAISSubtest(pe);
                  const max=WAIS_SUBTEST_MAX[stKey]||99;
                  return(
                    <div key={stKey} style={{padding:"12px 14px",background:si%2===0?"#fff":"#fdf6f7",borderBottom:`1px solid ${C.border}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                        <span style={{fontSize:12,fontWeight:700,color:C.textDark}}>{WAIS_SUBTEST_LABELS[stKey]||stKey}</span>
                        <span style={{fontSize:10,fontWeight:700,color:idxColors[idxKey]}}>{stKey.toUpperCase()}</span>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <div style={{flex:1}}>
                          <div style={{fontSize:9,fontWeight:700,color:C.textLight,letterSpacing:"0.05em",marginBottom:3}}>PUNTAJE BRUTO (0–{max})</div>
                          <input type="number" min={0} max={max} style={{...S.input,textAlign:"center",fontWeight:700}} value={bruto||""} onChange={e=>up(stKey+"_b",e.target.value)} placeholder={`0–${max}`}/>
                        </div>
                        {pe!==null&&cls&&(
                          <div style={{textAlign:"center",minWidth:60}}>
                            <div style={{fontSize:9,fontWeight:700,color:C.textLight,letterSpacing:"0.04em"}}>PE · Z</div>
                            <div style={{fontSize:18,fontWeight:800,color:cls?cls.color:C.textLight}}>{pe}</div>
                            <div style={{fontSize:11,color:cls?cls.color:C.textLight,fontWeight:700}}>{z>0?"+":""}{z}</div>
                          </div>
                        )}
                      </div>
                      {pe!==null&&cls&&<div style={{marginTop:6}}><span style={{...S.badge(cls?cls.color:C.textLight),fontSize:9}}>{cls?cls.label:"—"}</span></div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* ── Índices compuestos ── */}
        <div style={{marginTop:4}}>
          <div style={{fontWeight:700,fontFamily:font,fontSize:14,color:C.primary,marginBottom:12,borderBottom:`2px solid ${C.border}`,paddingBottom:6}}>Índices Compuestos y CIT (M=100, DS=15)</div>
          <p style={{fontFamily:font,fontSize:12,color:C.textLight,marginBottom:12}}>Ingresá los puntajes compuestos del protocolo.</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12}}>
            {WAIS_INDEXES.map(idx=>{
              const val=waisData[idx.key];
              const cls=classifyWAIS(val);
              const pct=val?waisPct(val):null;
              const ci=val?waisCI(val,idx.sem):null;
              return(
                <div key={idx.key} style={{border:`2px solid ${val&&cls.color?cls.color+"50":C.border}`,borderRadius:12,padding:14,background:val&&cls.color?`${cls.color}05`:"#fff"}}>
                  <div style={{fontSize:11,fontWeight:700,color:idx.color,fontFamily:font,marginBottom:6}}>{idx.short}</div>
                  <input type="number" min={40} max={160} style={{...S.input,fontWeight:800,fontSize:20,textAlign:"center"}} value={val||""} onChange={e=>up(idx.key,e.target.value)} placeholder="—"/>
                  {val&&cls&&cls.color&&pct!==null&&(
                    <>
                      <div style={{fontSize:11,color:C.textLight,fontFamily:font,marginTop:6,textAlign:"center"}}>Pc {pct} · IC95: {ci.lo}–{ci.hi}</div>
                      <div style={{marginTop:6,textAlign:"center"}}><span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span></div>
                      <div style={{height:5,background:C.border,borderRadius:3,marginTop:8,overflow:"hidden"}}>
                        <div style={{width:`${Math.min(Math.max(((parseInt(val)-40)/120)*100,0),100)}%`,height:"100%",background:cls?cls.color:C.textLight,borderRadius:3}}/>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Discrepancias */}
        {["icv","irp","imt","ivp"].filter(k=>waisData[k]).length>=2&&(
          <div style={{marginTop:20,background:`${C.primary}08`,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 18px"}}>
            <div style={{fontWeight:700,fontFamily:font,fontSize:13,color:C.primary,marginBottom:10}}>Discrepancias entre Índices</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {[["icv","irp"],["icv","imt"],["icv","ivp"],["irp","imt"],["irp","ivp"],["imt","ivp"]].map(([a,b])=>{
                const va=parseInt(waisData[a]),vb=parseInt(waisData[b]);
                if(isNaN(va)||isNaN(vb)) return null;
                const diff=Math.abs(va-vb);const sig=diff>=15;
                return(
                  <div key={a+b} style={{background:sig?`${C.warning}15`:"#f9f9f9",border:`1px solid ${sig?C.warning:C.border}`,borderRadius:8,padding:"6px 12px"}}>
                    <span style={{fontFamily:font,fontSize:12,fontWeight:700,color:sig?C.warning:C.textMid}}>{a.toUpperCase()}–{b.toUpperCase()}: {va-vb>0?"+":""}{va-vb}</span>
                    {sig&&<span style={{fontFamily:font,fontSize:11,color:C.warning,marginLeft:6}}>⚠ ≥15 pts</span>}
                  </div>
                );
              }).filter(Boolean)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function WAISResults({r}){
  const filled=WAIS_INDEXES.filter(idx=>r[idx.key]&&parseInt(r[idx.key])>0);
  if(!filled.length) return null;
  return(
    <div style={S.card}>
      <h3 style={S.sectionTitle}>🧩 WAIS-IV
        <span style={{fontSize:13,fontWeight:400,color:C.textLight}}> Wechsler (2008) · Estand. Chile</span>
      </h3>
      {/* Puntajes compuestos */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:12,marginBottom:20}}>
        {WAIS_INDEXES.map(idx=>{
          const val=parseInt(r[idx.key]);
          if(!val) return null;
          const cls=classifyWAIS(val);
          const pct=waisPct(val);
          const ci=waisCI(val,idx.sem);
          return(
            <div key={idx.key} style={{...S.indexBox,border:`2px solid ${cls?cls.color+"40":C.border}`,background:`${cls?cls.color:"transparent"}06`}}>
              <div style={{fontSize:11,fontWeight:700,color:idx.color,fontFamily:font}}>{idx.short}</div>
              <div style={{fontSize:38,fontWeight:800,fontFamily:font,color:cls?cls.color:C.textLight}}>{val}</div>
              <div style={{fontSize:11,color:C.textLight,fontFamily:font}}>Pc {pct}</div>
              <div style={{fontSize:11,color:C.textLight,fontFamily:font}}>IC95: {ci.lo}–{ci.hi}</div>
              <span style={{...S.badge(cls?cls.color:C.textLight),marginTop:4}}>{cls?cls.label:"—"}</span>
              <div style={{height:6,background:C.border,borderRadius:3,marginTop:8,overflow:"hidden"}}>
                <div style={{width:`${Math.min(Math.max(((val-40)/120)*100,0),100)}%`,height:"100%",background:cls?cls.color:C.textLight,borderRadius:3}}/>
              </div>
            </div>
          );
        }).filter(Boolean)}
      </div>
      {/* Subpruebas */}
      {WAIS_SUBTESTS.some(st=>r[st.key]&&parseInt(r[st.key])>0)&&(
        <div>
          <div style={{fontWeight:700,fontFamily:font,fontSize:13,color:C.textMid,marginBottom:10}}>Perfil de Subpruebas</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8}}>
            {WAIS_SUBTESTS.map(st=>{
              const val=parseInt(r[st.key]);
              if(!val) return null;
              const cls=classifyWAISSubtest(val);
              return(
                <div key={st.key} style={{...S.indexBox,padding:10,border:`1px solid ${cls?cls.color+"40":C.border}`}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.textLight,fontFamily:font}}>{st.label.split(" (")[0]}</div>
                  <div style={{fontSize:26,fontWeight:800,fontFamily:font,color:cls?cls.color:C.textLight}}>{val}</div>
                  <span style={{...S.badge(cls?cls.color:C.textLight),fontSize:9}}>{cls?cls.label:"—"}</span>
                </div>
              );
            }).filter(Boolean)}
          </div>
        </div>
      )}
      <div style={{background:`${C.primary}08`,border:`1px solid ${C.border}`,borderRadius:10,padding:"12px 18px",marginTop:16}}>
        <p style={{margin:0,fontSize:12,fontFamily:font,color:C.textDark}}>Ref: Wechsler (2008). <em>WAIS-IV</em>. NCS Pearson. Estandarización Chile: Rosas, Tenorio & Pizarro (CEDETI-UC). Rango de aplicación: 16:0–90:11 años.</p>
      </div>
    </div>
  );
}

// Dominios simplificados para el filtro
const DOMINIOS=["Atención","Funciones ejecutivas","Memoria","Lenguaje","Habilidades visoespaciales","Inteligencia","Screening","Emocionales","TDAH","TEA"];

const TEST_CATALOG={
  pruebas:[
    {id:"briefa",  label:"BRIEF-A",               group:"neuropsico", domains:["Funciones ejecutivas","Atención"], desc:"Evaluación conductual de la función ejecutiva en adultos — Autoinforme", baremos:"Roth et al. 2005"},
    {id:"moca",    label:"MoCA",                  group:"neuropsico", domains:["Screening"],                     desc:"Montreal Cognitive Assessment — Screening cognitivo global", baremos:"Nasreddine 2005 · Versión arg."},
    {id:"tmtfv",   label:"TMT + Fluidez Verbal",  group:"neuropsico", domains:["Atención","Funciones ejecutivas","Lenguaje"], desc:"Trail Making Test A+B + Fluidez Verbal semántica y fonológica", baremos:"Tombaugh 2004 · Baremos ARG"},
    {id:"stroop",  label:"Stroop",                 group:"neuropsico", domains:["Atención","Funciones ejecutivas"], desc:"Control inhibitorio e interferencia verbal", baremos:"Galaverna et al. 2014 ARG"},
    {id:"wcst",    label:"WCST",                   group:"neuropsico", domains:["Funciones ejecutivas"],          desc:"Wisconsin Card Sorting Test — Flexibilidad cognitiva, 64 cartas", baremos:"Axelrod et al. 1993"},
    {id:"ifs",     label:"IFS",                    group:"neuropsico", domains:["Funciones ejecutivas"],          desc:"INECO Frontal Screening — Screening frontal ejecutivo", baremos:"Torralva et al. 2009 · Corte ≥25"},
    {id:"waisiv",  label:"WAIS-IV",                group:"neuropsico", domains:["Inteligencia","Atención","Funciones ejecutivas"], desc:"Escala de Inteligencia de Wechsler para Adultos — IV", baremos:"Baremos Chile (apróx.)"},
    {id:"wiscv",   label:"WISC-V",                 group:"neuropsico", domains:["Inteligencia","Atención","Funciones ejecutivas"], desc:"Escala de Inteligencia de Wechsler para Niños — V", baremos:"Baremos Chile (apróx.)"},
    {id:"ravlt",   label:"RAVLT",                  group:"neuropsico", domains:["Memoria"],                      desc:"Rey Auditory Verbal Learning Test — Memoria verbal episódica", baremos:"Schmidt 1996"},
    {id:"tavec",   label:"TAVEC",                  group:"neuropsico", domains:["Memoria"],                      desc:"Test de Aprendizaje Verbal España-Complutense — Memoria verbal", baremos:"Benedet & Alejandre 1998 · ARG"},
    {id:"wms3",    label:"WMS-III",                group:"neuropsico", domains:["Memoria"],                      desc:"Wechsler Memory Scale III — Batería completa de memoria", baremos:"Wechsler 1997"},
    {id:"bads",    label:"BADS",                   group:"neuropsico", domains:["Funciones ejecutivas"],         desc:"Behavioral Assessment of the Dysexecutive Syndrome — Validez ecológica", baremos:"Farías Sarquís 2021 ARG"},
    {id:"rey",     label:"Figura Compleja de Rey", group:"neuropsico", domains:["Habilidades visoespaciales","Memoria"], desc:"Copia y evocación de figura compleja — Visuoconstrucción y memoria visual", baremos:"Meyers & Meyers 1995"},
    {id:"papdi",   label:"PAPDI",                  group:"neuropsico", domains:["Lenguaje"],                     desc:"Prueba Argentina de Pares Asociados Deterioro e Inteligencia — Denominación", baremos:"Manoiloff et al. 2018 ARG (apróx.)"},
    {id:"bnt",     label:"BNT",                    group:"neuropsico", domains:["Lenguaje"],                     desc:"Boston Naming Test — Denominación visual, 60/12 ítems", baremos:"Allegri et al. 1997 ARG (apróx.)"},
    {id:"caras",   label:"CARAS-R",                group:"neuropsico", domains:["Atención"],                    desc:"Test de Percepción de Diferencias — Atención sostenida y selectiva", baremos:"Thurstone & Yela · ARG por grado"},
    {id:"atencion-wais",label:"Atención WAIS/WMS", group:"neuropsico", domains:["Atención","Funciones ejecutivas"], desc:"Subtests de atención y MT de WAIS-IV + WMS-III (RD, CLA, SLN)", baremos:"Baremos incorporados"},
    {id:"d2",      label:"d2",                     group:"neuropsico", domains:["Atención"],                    desc:"Test de Atención d2 — Atención selectiva y concentración", baremos:"Bates & Lemay 2004"},
    {id:"neuropsi",label:"NEUROPSI",               group:"neuropsico", domains:["Screening","Atención","Memoria","Funciones ejecutivas"], desc:"Evaluación neuropsicológica breve — Batería de screening multifuncional", baremos:"Querejeta et al. 2017 ARG"},
    {id:"reloj",   label:"Test del Reloj",         group:"neuropsico", domains:["Screening","Habilidades visoespaciales","Funciones ejecutivas"], desc:"Dibujo del reloj — Screening de funciones visoespaciales y ejecutivas", baremos:"Freedman et al. 1994"},
    {id:"hotel",   label:"Test del Hotel",         group:"neuropsico", domains:["Funciones ejecutivas"],        desc:"Hotel Test (BADS) — Multitasking y memoria prospectiva", baremos:"Pinasco 2022 ARG"},
  ],
  cuestionarios:[
    {id:"mbi",   label:"MBI — Burnout",             group:"emocional",  domains:["Emocionales"],  selfReport:true,  desc:"Maslach Burnout Inventory — Agotamiento emocional y despersonalización",  baremos:"Maslach & Jackson 1981", consigna:"A continuación encontrará una serie de enunciados sobre sus sentimientos en el trabajo. Por favor, lea cada enunciado y decida con qué frecuencia siente lo que se describe."},
    {id:"snap",  label:"SNAP-IV",                   group:"familiar",   domains:["TDAH","TEA"],   selfReport:false, desc:"SNAP-IV — Síntomas de TDAH y ODD según heteroinforme (padres/maestros)", baremos:"Grañana et al. 2011 ARG", consigna:"Por favor, evaluá cada ítem según la intensidad del comportamiento del niño/a durante el último mes. Considerá cómo se comporta habitualmente en casa o en la escuela."},
    {id:"wurs",  label:"WURS — TDAH retrospectivo", group:"autoadmin",  domains:["TDAH"],         selfReport:true,  desc:"Wender Utah Rating Scale — Síntomas de TDAH en la infancia (retrospectivo)", baremos:"Scandar 2021 ARG", consigna:"Las siguientes preguntas se refieren a cómo eras cuando tenías entre 6 y 10 años. Por favor, recordá y respondé de acuerdo a cómo eras de niño/a, no como sos ahora."},
    {id:"asrs",  label:"ASRS v1.1 — TDAH actual",  group:"autoadmin",  domains:["TDAH"],         selfReport:true,  desc:"Adult ADHD Self-Report Scale — Síntomas actuales de TDAH en adultos", baremos:"Scandar 2021 ARG · OMS", consigna:"Por favor, respondé las siguientes preguntas acerca de cómo te has sentido y cómo te has comportado durante los últimos 6 meses."},
    {id:"scl90", label:"SCL-90-R",                  group:"autoadmin",  domains:["Emocionales"],  selfReport:true,  desc:"Symptom Checklist 90 Revisado — Inventario de síntomas psicopatológicos (90 ítems)", baremos:"Casullo & Pérez 1999/2008 ARG", consigna:"A continuación hay una lista de problemas y quejas que la gente experimenta a veces. Lee cada uno cuidadosamente e indicá cuánto malestar o perturbación te ha causado ese problema durante la última semana, incluyendo el día de hoy."},
    {id:"srs",   label:"SRS — Espectro Autista",    group:"familiar",   domains:["TEA"],          selfReport:false, desc:"Social Responsiveness Scale — Síntomas del espectro autista (heteroinforme)", baremos:"Constantino 2002 · Apróx.", consigna:"Por favor, evaluá los comportamientos del niño/a o adulto durante los últimos 6 meses. Respondé en base a lo que observás habitualmente en situaciones cotidianas."},
    {id:"brief_familiar", label:"BRIEF-2 (heteroinforme)", group:"familiar", domains:["Funciones ejecutivas","TDAH"], selfReport:false, desc:"BRIEF-2 — Inventario de evaluación conductual de funciones ejecutivas (padres/maestros)", baremos:"Gioia et al. 2000", consigna:"A continuación hay una lista de comportamientos. Por favor, evaluá con qué frecuencia el niño/a muestra cada comportamiento en casa o en la escuela durante los últimos 6 meses."},
  ],
};

// ALL_TABS construido sin spread (compatibilidad con parser)
function buildAllTabs(){
  const r=[{id:"patient",label:"👤 Paciente",section:"meta"},{id:"pacientes",label:"💾 Guardados",section:"meta"}];
  TEST_CATALOG.pruebas.forEach(t=>r.push(Object.assign({},t,{section:"pruebas",domain:Array.isArray(t.domains)?t.domains[0]:t.domain})));
  TEST_CATALOG.cuestionarios.forEach(t=>r.push(Object.assign({},t,{section:"cuestionarios",domain:Array.isArray(t.domains)?t.domains[0]:t.domain})));
  r.push({id:"results",label:"📊 Resultados",section:"meta"});
  return r;
}
const ALL_TABS=buildAllTabs();
function matchDomain(t, filterDom){
  if(!filterDom) return true;
  const domains=Array.isArray(t.domains)?t.domains:(t.domain?[t.domain]:[]);
  return domains.some(function(d){return d===filterDom||d.startsWith(filterDom);});
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── WURS DATA (Scandar 2021 ARG + Ward 1993) ────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// WURS-25: M=23.5 DE=13.16 población general ARG (n=1173, 18-50 años)
// Clínica TDAH: M=34.5 DE=11.1
// Corte Scandar especificidad 90%: ≥36.5 | sensibilidad 90%: ≥14.5
// Corte Ward (1993): ≥46 (población no clínica norteamericana)
const WURS_NORM_ARG={mean:23.5,sd:13.16};
const WURS_CLINICAL={mean:34.5,sd:11.1};

// Tabla V de Scandar (2021) — percentiles WURS-25 población general ARG 18-50
const WURS_PERCENTILES=[
  {p:1,val:3},{p:5,val:6},{p:10,val:8},{p:15,val:9},{p:20,val:10},
  {p:25,val:11},{p:30,val:12},{p:35,val:13},{p:50,val:15},
  {p:55,val:16},{p:60,val:17},{p:65,val:17},{p:70,val:18},
  {p:75,val:19},{p:80,val:20},{p:85,val:21},{p:90,val:23},
  {p:95,val:25},{p:99,val:29},
];

function wursPercentile(score){
  // interpolación lineal
  const pts=WURS_PERCENTILES;
  if(score<=pts[0].val) return pts[0].p;
  if(score>=pts[pts.length-1].val) return pts[pts.length-1].p;
  for(let i=0;i<pts.length-1;i++){
    if(score>=pts[i].val&&score<=pts[i+1].val){
      const frac=(score-pts[i].val)/(pts[i+1].val-pts[i].val);
      return Math.round(pts[i].p+frac*(pts[i+1].p-pts[i].p));
    }
  }
  return null;
}

// Los 25 ítems de la WURS-25 (Rodríguez-Jiménez 2001, validación española usada por Scandar)
// Numerados según la escala original de 61 ítems
const WURS25_ITEMS=[
  {num:1,label:"Activo, no paraba nunca"},
  {num:3,label:"Problemas de concentración; me distraía con facilidad"},
  {num:4,label:"Ansioso, preocupado"},
  {num:5,label:"Nervioso, inquieto"},
  {num:6,label:"Poco atento, «en las nubes»"},
  {num:7,label:"Mucho temperamento; saltaba con facilidad"},
  {num:9,label:"Explosiones de genio, rabietas"},
  {num:10,label:"Problemas para terminar las cosas que empezaba"},
  {num:11,label:"Testarudo, cabezota"},
  {num:13,label:"Imprudente, temerario; hacía travesuras"},
  {num:15,label:"Desobediente con mis padres; rebelde, contestón"},
  {num:17,label:"Irritable"},
  {num:19,label:"Descuidado; me organizaba mal"},
  {num:20,label:"Cambios de humor frecuente: alegre, triste..."},
  {num:21,label:"Enfadado"},
  {num:24,label:"Impulsivo; hacía las cosas sin pensar"},
  {num:25,label:"Tendencia a ser inmaduro"},
  {num:26,label:"Sentimientos de culpa; remordimientos"},
  {num:27,label:"Perdía el control de mí mismo"},
  {num:28,label:"Tendencia a ser o actuar irracionalmente"},
  {num:29,label:"Poco popular entre los demás chicos"},
  {num:35,label:"Me metía en las peleas"},
  {num:39,label:"Me dejaba llevar demasiado por los demás"},
  {num:40,label:"Dificultad para ponerme en el lugar de otros"},
  {num:41,label:"Problemas con las autoridades, en la escuela"},
];

// Ítems adicionales WURS-61 (los 36 restantes, sin ítem 33 "tomboyish")
const WURS61_EXTRA_ITEMS=[
  {num:2,label:"Miedo de las cosas"},
  {num:8,label:"Tímido, sensible"},
  {num:12,label:"Triste, deprimido"},
  {num:14,label:"Insatisfecho con la vida; no me gustaba hacer ninguna cosa"},
  {num:16,label:"Mala opinión de mí mismo"},
  {num:18,label:"Extravertido, amigable; me gustaba la compañía de los demás"},
  {num:22,label:"Popular; tenía amigos"},
  {num:23,label:"Me organizaba bien; ordenado, limpio"},
  {num:30,label:"Mala coordinación; no hacía deporte"},
  {num:31,label:"Miedo a perder el control"},
  {num:32,label:"Buena coordinación; siempre me escogían de los primeros"},
  {num:34,label:"Me escapaba de casa"},
  {num:36,label:"Molestaba a otros niños"},
  {num:37,label:"Líder, mandón"},
  {num:38,label:"Dificultades para despertarme"},
  {num:42,label:"Problemas con la policía, condenas"},
  {num:43,label:"Dolor de cabeza"},
  {num:44,label:"Dolor de estómago"},
  {num:45,label:"Estreñimiento"},
  {num:46,label:"Diarrea"},
  {num:47,label:"Alergia a alimentos"},
  {num:48,label:"Otras alergias"},
  {num:49,label:"Me orinaba en la cama"},
  {num:50,label:"En general un buen estudiante; aprendía rápido"},
  {num:51,label:"En general un mal estudiante; me costaba aprender"},
  {num:52,label:"Lento para aprender a leer"},
  {num:53,label:"Leía despacio"},
  {num:54,label:"Dislexia"},
  {num:55,label:"Problemas para escribir, deletrear"},
  {num:56,label:"Problemas con los números o las matemáticas"},
  {num:57,label:"Mala caligrafía"},
  {num:58,label:"Capaz de leer bastante bien, pero nunca me gustó hacerlo"},
  {num:59,label:"No alcancé todo mi potencial"},
  {num:60,label:"Repetí curso"},
  {num:61,label:"Expulsado del colegio"},
];

// Factores WURS-61 según Gift et al. (2021) — ítems con carga >0.4
// Factor 1: Humor disruptivo/conducta
const WURS61_FACTORS={
  F1:{label:"Humor disruptivo / Conducta",items:[5,7,9,11,13,15,17,20,21,27,28,34,35,36,40,41,42]},
  F2:{label:"TDAH (inatención/desorganización)",items:[3,6,10,19,23,24,25,57,59]},
  F3:{label:"Rendimiento académico",items:[50,51,52,53,54,55,58,60,61]},
  F4:{label:"Social",items:[1,8,16,18,22,29,30,32,37,39]},
  F5:{label:"Ansiedad / Disforia",items:[2,4,12,26,31,43,44,45,46]},
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── ASRS DATA (Scandar 2021 ARG) ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// Población general ARG n=1173
// ASRS-T: M=30.15 DE=10.70 | ASRS-I: M=15.22 DE=5.61 | ASRS-H: M=14.96 DE=6.25
// Muestra clínica TDAH: ASRS-T=46(9.8) | ASRS-I=21.2(4.8) | ASRS-H=27(5.2)
// Sin diferencias por género. >50 años levemente mayor (d=0.18).

// Tabla V Scandar — percentiles 18-50 años
const ASRS_PERCENTILES_T=[
  {p:1,val:8},{p:5,val:13.5},{p:10,val:17},{p:15,val:19},{p:20,val:20},
  {p:25,val:22},{p:30,val:24},{p:35,val:25},{p:50,val:29},
  {p:55,val:31},{p:60,val:33},{p:65,val:34},{p:70,val:35},
  {p:75,val:37},{p:80,val:39},{p:85,val:41},{p:90,val:44},
  {p:95,val:48},{p:99,val:56},
];
const ASRS_PERCENTILES_I=[
  {p:1,val:3},{p:5,val:5},{p:10,val:7},{p:15,val:8},{p:20,val:9},
  {p:25,val:10},{p:30,val:11},{p:35,val:12},{p:50,val:15},
  {p:55,val:16},{p:60,val:17},{p:65,val:17},{p:70,val:18},
  {p:75,val:19},{p:80,val:20},{p:85,val:21},{p:90,val:23},
  {p:95,val:25},{p:99,val:29},
];
const ASRS_PERCENTILES_H=[
  {p:1,val:2.15},{p:5,val:6},{p:10,val:8},{p:15,val:9},{p:20,val:11},
  {p:25,val:12},{p:30,val:13},{p:35,val:14},{p:50,val:16},
  {p:55,val:16.75},{p:60,val:18},{p:65,val:19},{p:70,val:19.5},
  {p:75,val:21},{p:80,val:22},{p:85,val:24},{p:90,val:27.5},
  {p:95,val:29},{p:99,val:32.95},
];

function asrsPercentile(score,table){
  if(!table||score===null||score==="") return null;
  const pts=table;
  if(score<=pts[0].val) return pts[0].p;
  if(score>=pts[pts.length-1].val) return pts[pts.length-1].p;
  for(let i=0;i<pts.length-1;i++){
    if(score>=pts[i].val&&score<=pts[i+1].val){
      const frac=(score-pts[i].val)/(pts[i+1].val-pts[i].val);
      return Math.round(pts[i].p+frac*(pts[i+1].p-pts[i].p));
    }
  }
  return null;
}

// 18 ítems ASRS (orden original OMS / versión argentina)
// Factor 1 (ítems ASRS): inatención → ítems 1,2,3,4,7,8,9,10,11,12
// Factor 2: hiperactividad/impulsividad → ítems 5,6,13,14,15,16,17,18
// (según Scandar 2021, Tabla III: Factor 1 = inatención, Factor 2 = hiperactividad)
const ASRS_ITEMS=[
  {num:1,factor:"I",label:"¿Con qué frecuencia tiene dificultades para terminar los detalles finales de un proyecto, después de haber completado las partes más difíciles?"},
  {num:2,factor:"I",label:"¿Con qué frecuencia tiene dificultades para mantener las cosas en orden cuando tiene que hacer una tarea que requiere organización?"},
  {num:3,factor:"I",label:"¿Con qué frecuencia tiene problemas para recordar citas u obligaciones?"},
  {num:4,factor:"I",label:"Cuando tiene una tarea que requiere mucho pensamiento, ¿con qué frecuencia evita o demora el inicio de la tarea?"},
  {num:5,factor:"H",label:"¿Con qué frecuencia mueve nerviosamente las manos o los pies cuando tiene que permanecer sentado durante mucho tiempo?"},
  {num:6,factor:"H",label:"¿Con qué frecuencia se siente excesivamente activo y compelido a hacer cosas, como si le impulsara un motor?"},
  {num:7,factor:"I",label:"¿Con qué frecuencia comete errores por descuido cuando trabaja en un proyecto difícil?"},
  {num:8,factor:"I",label:"¿Con qué frecuencia tiene dificultades para mantener la atención cuando realiza tareas repetitivas?"},
  {num:9,factor:"I",label:"¿Con qué frecuencia tiene dificultades para concentrarse en lo que la gente le dice, incluso cuando le hablan directamente a usted?"},
  {num:10,factor:"I",label:"¿Con qué frecuencia extravía o tiene dificultades para encontrar las cosas en casa o en el trabajo?"},
  {num:11,factor:"I",label:"¿Con qué frecuencia se distrae con la actividad o el ruido a su alrededor?"},
  {num:12,factor:"I",label:"¿Con qué frecuencia se levanta de su asiento en reuniones u otras situaciones en las que se espera que permanezca sentado?"},
  {num:13,factor:"H",label:"¿Con qué frecuencia se siente inquieto o nervioso?"},
  {num:14,factor:"H",label:"¿Con qué frecuencia tiene dificultades para descansar cuando tiene tiempo libre?"},
  {num:15,factor:"H",label:"¿Con qué frecuencia habla demasiado en situaciones sociales?"},
  {num:16,factor:"H",label:"¿Con qué frecuencia, en el transcurso de una conversación, termina las frases de las personas antes de que ellas puedan terminarlas?"},
  {num:17,factor:"H",label:"¿Con qué frecuencia tiene dificultades para esperar su turno en situaciones en las que el turno es importante?"},
  {num:18,factor:"H",label:"¿Con qué frecuencia interrumpe a los demás cuando están ocupados?"},
];
const ASRS_SCALE=["Nunca","Raramente","A veces","A menudo","Muy a menudo"];

// ══════════════════════════════════════════════════════════════════════════════
// ─── TEST DEL RELOJ DATA (Cacho et al. 1999) ─────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// Escala 0-10: esfera (0-2) + números (0-4) + manecillas (0-4)
// Puntuación "a la orden" (TRO): corte ≤6 → positivo (Sens 92.8%, Esp 93.5%)
// Puntuación "a la copia" (TRC): corte ≤8 → positivo (Sens 73.1%, Esp 90.6%)
// TRO+TRC: corte ≤15 → positivo (Sens 94.9%, Esp 90.6%)

const RELOJ_CRITERIA={
  esfera:[
    {pts:2,desc:"Dibujo normal. Esfera circular u ovalada con pequeñas distorsiones por temblor."},
    {pts:1,desc:"Incompleto o con alguna distorsión significativa. Esfera muy asimétrica."},
    {pts:0,desc:"Ausencia o dibujo totalmente distorsionado."},
  ],
  numeros:[
    {pts:4,desc:"Todos los números presentes y en el orden correcto. Solo «pequeños errores» en la localización espacial en menos de 4 números."},
    {pts:3.5,desc:"«Pequeños errores» en la localización espacial se dan en 4 o más números."},
    {pts:3,desc:"Todos presentes con error significativo en la localización espacial. Números con algún desorden de secuencia (menos de 4 números)."},
    {pts:2,desc:"Omisión o adición de algún número, pero sin grandes distorsiones. Números con algún desorden de secuencia (4 o más). Los 12 números en sentido antihorario. Todos presentes pero con gran distorsión espacial. Los 12 números en una línea."},
    {pts:1,desc:"Ausencia o exceso de números con gran distorsión espacial. Alineación numérica con falta o exceso. Rotación inversa con falta o exceso."},
    {pts:0,desc:"Ausencia o escasa representación de números (menos de 6 números dibujados)."},
  ],
  manecillas:[
    {pts:4,desc:"Las manecillas están en posición correcta y con las proporciones adecuadas de tamaño (la de la hora más corta)."},
    {pts:3.5,desc:"Las manecillas en posición correcta pero ambas de igual tamaño."},
    {pts:3,desc:"Pequeños errores en la localización de las manecillas. Aguja de minutos más corta que la de la hora, con pauta horaria correcta."},
    {pts:2,desc:"Gran distorsión en la localización. Cuando las manecillas no se juntan en el punto central y marcan la hora correcta."},
    {pts:1,desc:"Cuando las manecillas no se juntan en el punto central y marcan una hora incorrecta. Presencia de una sola manecilla o esbozo de las dos."},
    {pts:0,desc:"Ausencia de manecillas o perseveración en el dibujo. Efecto «rueda de carro»."},
  ],
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── TEST DEL HOTEL DATA (Pinasco et al. 2022 ARG) ──────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// N=160 controles sanos 19-60 años, ≥12 años educación, Buenos Aires
// Variables: tareas realizadas (máx 5), desvío total tiempo (seg), desvío botones (seg)
// Sin efecto de edad ni educación en 19-60 años con ≥12 años educación
// Diferencias pequeñas por sexo en desvío tiempo y botones (d=0.2 y 0.15)

const HOTEL_NORMS={
  F:{ // Mujeres (interpolación de tablas 3 Pinasco 2022)
    "19-29":{tareasM:4.89,tareasSD:0.31,tiempoM:365.81,tiempoSD:140.84,botonesM:162.62,botonesSD:186.81},
    "30-39":{tareasM:4.86,tareasSD:0.35,tiempoM:368.83,tiempoSD:184.59,botonesM:236.72,botonesSD:281.05},
    "40-49":{tareasM:4.81,tareasSD:0.47,tiempoM:420.18,tiempoSD:205.95,botonesM:323.25,botonesSD:386.68},
    "50-59":{tareasM:4.70,tareasSD:0.72,tiempoM:431.25,tiempoSD:191.97,botonesM:211.74,botonesSD:241.80},
  },
  M:{ // Varones (tabla 4)
    "19-29":{tareasM:4.92,tareasSD:0.27,tiempoM:302.03,tiempoSD:208.79,botonesM:131.42,botonesSD:156.42},
    "30-39":{tareasM:4.81,tareasSD:0.55,tiempoM:330.78,tiempoSD:192.03,botonesM:158.11,botonesSD:210.50},
    "40-49":{tareasM:4.71,tareasSD:0.64,tiempoM:329.95,tiempoSD:187.94,botonesM:205.57,botonesSD:267.39},
    "50-59":{tareasM:4.70,tareasSD:0.58,tiempoM:338.29,tiempoSD:182.09,botonesM:309.29,botonesSD:355.15},
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── CARAS-R DATA (Thurstone & Yela · Baremos ARG, TEA Ediciones) ───────────
// ══════════════════════════════════════════════════════════════════════════════
// A = aciertos (targets correctamente tachados, máx 60)
// E = errores (distractores tachados incorrectamente)
// A-E = puntuación principal; ICI = (A-E)/(A+E)×100 (Índice Control Impulsividad)
// Baremos: varones y mujeres combinados, muestra argentina
const CARAS_NORMS={
  "1":{label:"1° EP",age:"6-7",n:353,A:{m:14.01,sd:6.84},E:{m:1.38,sd:1.92},AE:{m:12.63,sd:7.05}},
  "2":{label:"2° EP",age:"7-8",n:591,A:{m:16.64,sd:6.57},E:{m:1.28,sd:1.93},AE:{m:15.36,sd:6.65}},
  "3":{label:"3° EP",age:"8-9",n:700,A:{m:21.55,sd:7.83},E:{m:1.89,sd:3.12},AE:{m:19.67,sd:8.40}},
  "4":{label:"4° EP",age:"9-10",n:694,A:{m:23.23,sd:7.35},E:{m:1.54,sd:2.12},AE:{m:22,sd:8}},
  "5":{label:"5° EP",age:"10-11",n:790,A:{m:26.92,sd:8.3},E:{m:1.45,sd:2.79},AE:{m:25,sd:9}},
  "6":{label:"6° EP",age:"11-12",n:563,A:{m:28.57,sd:7.86},E:{m:1.14,sd:1.65},AE:{m:27.43,sd:7.99}},
  "7":{label:"7° EP",age:"12-13",n:559,A:{m:32.25,sd:8.71},E:{m:1.17,sd:1.56},AE:{m:31.09,sd:8.88}},
};
function getEneatipo(z){return Math.min(Math.max(Math.round(5+2*z),1),9);}

// ══════════════════════════════════════════════════════════════════════════════
// ─── d2 DATA (Bates & Lemay 2004 · N=364 · 28-32 años · EEUU) ──────────────
// ══════════════════════════════════════════════════════════════════════════════
// 14 filas × 47 estímulos · Tiempo: 20 seg/fila
// Para normas por edad completas: Brickenkamp & Zillmer (1998) Manual d2
const D2_NORMS={
  totN: {m:496.92,sd:75.00,label:"TOT# — Total items procesados",better:"high"},
  oErr: {m:15.93, sd:14.46,label:"O ERR — Omisiones (targets no tachados)",better:"low"},
  cErr: {m:1.24,  sd:1.78, label:"C ERR — Comisiones (distractores tachados)",better:"low"},
  totErr:{m:17.18,sd:15.03,label:"TOT ERR — Total de errores",better:"low"},
  pctErr:{m:3.0,  sd:3.0,  label:"% ERR — Porcentaje de error (%)",better:"low"},
  totCorr:{m:479.74,sd:73.90,label:"TOT CORR — Total correctamente procesados",better:"high"},
  conc:  {m:195.19,sd:37.15,label:"CONC — Rendimiento de concentración",better:"high"},
  fluct: {m:12.34,sd:4.56, label:"FLUCT — Fluctuación (max−min filas)",better:"low"},
  errDist:{m:2.05,sd:1.28, label:"ERR DIST — Distribución de errores (últ4−prim4)",better:"low"},
};

// ══════════════════════════════════════════════════════════════════════════════
// ─── NEUROPSI DATA (Ostrosky-Solís et al. · Normas ARG: Querejeta et al. 2017)
// ══════════════════════════════════════════════════════════════════════════════
const NEUROPSI_SUBTESTS=[
  {key:"ori",     domain:"Orientación", label:"Orientación temporal / espacial / personal", max:6},
  {key:"digitos", domain:"Atención",    label:"Dígitos en regresión (orden inverso)", max:6},
  {key:"detVis",  domain:"Atención",    label:"Detección visual (aciertos / 60 seg)", max:16},
  {key:"calc20",  domain:"Atención",    label:"Cálculo 20−3 (series correctas)", max:5},
  {key:"memVerbCod", domain:"Codificación", label:"Memoria verbal espontánea — promedio 3 ensayos", max:6},
  {key:"copia",   domain:"Codificación", label:"Proceso visoespacial — Copia figura semicompleja", max:12},
  {key:"denom",   domain:"Lenguaje",    label:"Denominación (8 láminas)", max:8},
  {key:"repet",   domain:"Lenguaje",    label:"Repetición de palabras y frases", max:4},
  {key:"comprens",domain:"Lenguaje",    label:"Comprensión de instrucciones (lámina 10)", max:6},
  {key:"lectura", domain:"Lenguaje",    label:"Lectura comprensiva", max:3},
  {key:"escritura",domain:"Lenguaje",   label:"Escritura (dictado + copia)", max:2},
  {key:"semej",   domain:"FE",          label:"Semejanzas abstractas", max:6},
  {key:"calcFE",  domain:"FE",          label:"Cálculo aritmético", max:3},
  {key:"secuenc", domain:"FE",          label:"Secuenciación gráfica", max:1},
  {key:"camMano", domain:"Motoras",     label:"Cambio de posición de la mano", max:4},
  {key:"movAlt",  domain:"Motoras",     label:"Movimientos alternos de las dos manos", max:2},
  {key:"reacOp",  domain:"Motoras",     label:"Reacciones opuestas", max:2},
  {key:"memVis",  domain:"Evocación",   label:"Memoria visoespacial — reproducción diferida", max:12},
  {key:"memVerbEv",domain:"Evocación",  label:"Memoria verbal espontánea — evocación", max:6},
  {key:"memClaves",domain:"Evocación",  label:"Memoria verbal por claves semánticas", max:6},
  {key:"reconoc", domain:"Evocación",   label:"Reconocimiento verbal", max:6},
];
const NEUROPSI_DOMAINS={
  "Orientación":{max:6, color:C.primary},
  "Atención":   {max:27,color:"#3b6e8f"},
  "Codificación":{max:18,color:"#4a7c59"},
  "Lenguaje":   {max:23,color:"#7c4a6e"},
  "FE":         {max:10,color:"#8f5e3b"},
  "Motoras":    {max:8, color:"#5e6e3b"},
  "Evocación":  {max:30,color:"#6e3b3b"},
};
const NEUROPSI_TOTAL_MAX=122;

// ══════════════════════════════════════════════════════════════════════════════
// ─── WISC-V DATA (Wechsler 2017 · Adaptación Chile: Rosas & Pizarro) ────────
// ══════════════════════════════════════════════════════════════════════════════
// Puntajes escalares: M=10 DS=3 (rango 1-19)
// Puntajes compuestos (CIT e índices): M=100 DS=15
// Rango de edad: 6:0 – 16:11 años
// Las tablas de conversión bruto→escalar están en el Apéndice A (documento separado)
// → El clínico ingresa los puntajes ya calculados desde el protocolo de registro

const WISC5_SUBTESTS=[
  // --- Subpruebas primarias (CIT) ---
  {key:"CC",  label:"Construcción con Cubos",    abbr:"CC",  cat:"CIT", domain:"IVE"},
  {key:"AN",  label:"Analogías",                  abbr:"AN",  cat:"CIT", domain:"ICV"},
  {key:"MR",  label:"Matrices de Razonamiento",   abbr:"MR",  cat:"CIT", domain:"IRF"},
  {key:"RD",  label:"Retención de Dígitos",       abbr:"RD",  cat:"CIT", domain:"IMT"},
  {key:"CLA", label:"Claves",                     abbr:"CLA", cat:"CIT", domain:"IVP"},
  {key:"VOC", label:"Vocabulario",                abbr:"VOC", cat:"CIT", domain:"ICV"},
  {key:"BAL", label:"Balanzas",                   abbr:"BAL", cat:"CIT", domain:"IRF"},
  // --- Subpruebas primarias (no CIT) ---
  {key:"RV",  label:"Rompecabezas Visuales",      abbr:"RV",  cat:"Primaria", domain:"IVE"},
  {key:"RI",  label:"Retención de Imágenes",      abbr:"RI",  cat:"Primaria", domain:"IMT"},
  {key:"BS",  label:"Búsqueda de Símbolos",       abbr:"BS",  cat:"Primaria", domain:"IVP"},
  // --- Subpruebas complementarias ---
  {key:"INF", label:"Información",                abbr:"INF", cat:"Complementaria", domain:"ICV"},
  {key:"SLN", label:"Secuenciación Letras-Números",abbr:"SLN",cat:"Complementaria", domain:"IMT"},
  {key:"CAN", label:"Cancelación",                abbr:"CAN", cat:"Complementaria", domain:"IVP"},
  {key:"COM", label:"Comprensión",                abbr:"COM", cat:"Complementaria", domain:"ICV"},
  {key:"ARI", label:"Aritmética",                 abbr:"ARI", cat:"Complementaria", domain:"IRC"},
];

// Índices principales y secundarios
const WISC5_INDEXES=[
  // Principales
  {key:"CIT", label:"Escala Total",                         abbr:"CIT",  type:"principal", subtests:["CC","AN","MR","RD","CLA","VOC","BAL"]},
  {key:"ICV", label:"Comprensión Verbal",                   abbr:"ICV",  type:"principal", subtests:["AN","VOC"]},
  {key:"IVE", label:"Visoespacial",                         abbr:"IVE",  type:"principal", subtests:["CC","RV"]},
  {key:"IRF", label:"Razonamiento Fluido",                  abbr:"IRF",  type:"principal", subtests:["MR","BAL"]},
  {key:"IMT", label:"Memoria de Trabajo",                   abbr:"IMT",  type:"principal", subtests:["RD","RI"]},
  {key:"IVP", label:"Velocidad de Procesamiento",           abbr:"IVP",  type:"principal", subtests:["CLA","BS"]},
  // Secundarios
  {key:"IRC", label:"Razonamiento Cuantitativo",            abbr:"IRC",  type:"secundario", subtests:["BAL","ARI"]},
  {key:"IMTA",label:"Memoria de Trabajo Auditiva",          abbr:"IMTA", type:"secundario", subtests:["RD","SLN"]},
  {key:"INV", label:"No Verbal",                            abbr:"INV",  type:"secundario", subtests:["CC","MR","BAL","RV","RI","CLA","BS"]},
  {key:"IHG", label:"Habilidad General",                    abbr:"IHG",  type:"secundario", subtests:["AN","VOC","CC","MR","BAL","RD","RI"]},
  {key:"ICC", label:"Competencia Cognitiva",                abbr:"ICC",  type:"secundario", subtests:["RD","RI","CLA","BS"]},
];

// SEM (error estándar de medición) para IC 95% — Valores típicos WISC-V
const WISC5_SEM={
  CIT:2.16, ICV:3.72, IVE:4.09, IRF:3.72, IMT:4.52, IVP:4.71,
  IRC:4.33, IMTA:4.52, INV:3.96, IHG:3.60, ICC:3.91,
};

function classifyWISC5(score){
  if(!score||isNaN(score)) return{label:"—",color:C.textLight,range:"—"};
  const s=parseFloat(score);
  if(s>=130) return{label:"Muy Superior",color:C.success,range:"≥130"};
  if(s>=120) return{label:"Superior",color:"#2d7a4f",range:"120-129"};
  if(s>=110) return{label:"Promedio Alto",color:"#3b8f6e",range:"110-119"};
  if(s>=90)  return{label:"Promedio",color:C.primary,range:"90-109"};
  if(s>=80)  return{label:"Promedio Bajo",color:C.warning,range:"80-89"};
  if(s>=70)  return{label:"Límite",color:"#c06000",range:"70-79"};
  return{label:"Extremadamente Bajo",color:C.danger,range:"≤69"};
}
function wisc5Pct(score){
  if(!score||isNaN(score)) return null;
  const z=(parseFloat(score)-100)/15;
  const pct=Math.round(50*(1+erf(z/Math.sqrt(2))));
  return Math.min(Math.max(pct,1),99);
}
function wisc5CI(score,sem){
  if(!score||isNaN(score)||!sem) return null;
  const s=parseFloat(score);
  return{lo:Math.round(s-1.96*sem),hi:Math.round(s+1.96*sem)};
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── SCL-90-R DATA (Derogatis 1994 · Adaptación ARG: Casullo & Pérez 1999/2008)
// ══════════════════════════════════════════════════════════════════════════════
// 9 dimensiones + 3 índices globales · Escala 0-4 por ítem
// Puntuación: media de ítems por dimensión (0-4)
// IGS = suma_total / 90 · PSDI = suma_total / PST · PST = n_ítems > 0
// T-scores: normas adultos argentinos 18-65 años, por sexo
// Punto de corte clínico: T ≥ 63 (Derogatis 1994, adoptado en práctica argentina)

const SCL90_ITEMS=[
  {n:1,d:"SOM",l:"Dolores de cabeza"},{n:2,d:"ANS",l:"Nerviosismo o temblor interno"},
  {n:3,d:"OC",l:"Pensamientos desagradables que no se van"},{n:4,d:"SOM",l:"Desmayos o mareos"},
  {n:5,d:"DEP",l:"Poco interés en las relaciones sexuales"},{n:6,d:"SI",l:"Tendencia a criticar a los demás"},
  {n:7,d:"PSIC",l:"Alguien puede controlar sus pensamientos"},{n:8,d:"PAR",l:"Culpar a los demás de sus problemas"},
  {n:9,d:"OC",l:"Dificultad para recordar las cosas"},{n:10,d:"OC",l:"Descuido en la forma de vestir"},
  {n:11,d:"HOS",l:"Fácilmente molestado o irritado"},{n:12,d:"SOM",l:"Dolores en el corazón o pecho"},
  {n:13,d:"FOB",l:"Temor en espacios abiertos o en la calle"},{n:14,d:"DEP",l:"Muy poca energía"},
  {n:15,d:"DEP",l:"Pensamientos de terminar con su vida"},{n:16,d:"PSIC",l:"Oír voces que otros no escuchan"},
  {n:17,d:"ANS",l:"Temblor de cuerpo"},{n:18,d:"PAR",l:"Sentir que no puede confiar en nadie"},
  {n:19,d:"add",l:"Poco apetito"},{n:20,d:"DEP",l:"Llorar fácilmente"},
  {n:21,d:"SI",l:"Timidez con personas del otro sexo"},{n:22,d:"DEP",l:"Sentirse atrapado o encerrado"},
  {n:23,d:"ANS",l:"Miedo repentino sin razón"},{n:24,d:"HOS",l:"Arranques de cólera incontrolables"},
  {n:25,d:"FOB",l:"Miedo a salir de casa solo"},{n:26,d:"DEP",l:"Sentirse culpable por lo que piensa"},
  {n:27,d:"SOM",l:"Dolores en la cintura"},{n:28,d:"OC",l:"Bloqueado para realizar las cosas"},
  {n:29,d:"DEP",l:"Sentirse solo"},{n:30,d:"DEP",l:"Sentirse triste"},
  {n:31,d:"DEP",l:"Preocuparse demasiado por todo"},{n:32,d:"DEP",l:"Sin interés en nada"},
  {n:33,d:"ANS",l:"Sentirse temeroso"},{n:34,d:"SI",l:"Sus sentimientos son fácilmente heridos"},
  {n:35,d:"PSIC",l:"Los demás se dan cuenta de sus pensamientos"},{n:36,d:"SI",l:"Los demás no le comprenden"},
  {n:37,d:"SI",l:"Los demás no son amigables"},{n:38,d:"OC",l:"Hacer las cosas muy lentamente"},
  {n:39,d:"ANS",l:"Palpitaciones o latidos muy fuertes"},{n:40,d:"SOM",l:"Náuseas o malestar estomacal"},
  {n:41,d:"SI",l:"Sentirse inferior a los demás"},{n:42,d:"SOM",l:"Músculos adoloridos"},
  {n:43,d:"PAR",l:"Sentir que le vigilan o hablan de usted"},{n:44,d:"add",l:"Dificultad para dormirse"},
  {n:45,d:"OC",l:"Necesidad de controlar o verificar lo que hace"},{n:46,d:"OC",l:"Dificultad para tomar decisiones"},
  {n:47,d:"FOB",l:"Miedo a viajar en autobús, metro, tren"},{n:48,d:"SOM",l:"Dificultad para respirar"},
  {n:49,d:"SOM",l:"Oleadas de calor o frío"},{n:50,d:"FOB",l:"Mantenerse alejado de ciertos lugares"},
  {n:51,d:"OC",l:"Quedarse la mente en blanco"},{n:52,d:"SOM",l:"Adormecimiento u hormigueos"},
  {n:53,d:"SOM",l:"Nudo en la garganta"},{n:54,d:"DEP",l:"Sin esperanza frente al futuro"},
  {n:55,d:"OC",l:"Problemas para concentrarse"},{n:56,d:"SOM",l:"Debilidad en partes del cuerpo"},
  {n:57,d:"ANS",l:"Sentirse muy tenso"},{n:58,d:"SOM",l:"Pesadez en brazos o piernas"},
  {n:59,d:"add",l:"Pensamientos de muerte o agonía"},{n:60,d:"add",l:"Comer demasiado"},
  {n:61,d:"SI",l:"Incómodo cuando le miran o hablan de usted"},{n:62,d:"PSIC",l:"Pensamientos que no son suyos"},
  {n:63,d:"HOS",l:"Necesidad de golpear o herir a alguien"},{n:64,d:"add",l:"Despertarse muy temprano"},
  {n:65,d:"OC",l:"Necesidad de repetir las mismas acciones"},{n:66,d:"add",l:"Sueño intranquilo o perturbado"},
  {n:67,d:"HOS",l:"Necesidad de romper o destrozar cosas"},{n:68,d:"PAR",l:"Ideas que los demás no comprenden"},
  {n:69,d:"SI",l:"Muy pendiente de lo que los demás piensan"},{n:70,d:"FOB",l:"Incómodo donde hay mucha gente"},
  {n:71,d:"DEP",l:"Todo cuesta mucho esfuerzo"},{n:72,d:"ANS",l:"Ataques de terror o pánico"},
  {n:73,d:"SI",l:"Incómodo comiendo o bebiendo en público"},{n:74,d:"HOS",l:"Meterse en discusiones frecuentes"},
  {n:75,d:"FOB",l:"Nervioso cuando le dejan solo"},{n:76,d:"PAR",l:"No recibir el reconocimiento que merece"},
  {n:77,d:"PSIC",l:"Sentirse solo aunque esté con gente"},{n:78,d:"ANS",l:"Tan inquieto que no puede estar sentado"},
  {n:79,d:"DEP",l:"Sentirse inútil"},{n:80,d:"ANS",l:"Sensación de que algo malo va a pasar"},
  {n:81,d:"HOS",l:"Gritar o tirar cosas"},{n:82,d:"FOB",l:"Miedo a desmayarse en público"},
  {n:83,d:"PAR",l:"Sentir que se pueden aprovechar de usted"},{n:84,d:"PSIC",l:"Pensamientos sobre el sexo que perturban"},
  {n:85,d:"PSIC",l:"Idea de que debería ser castigado por sus pecados"},{n:86,d:"ANS",l:"Pensamientos e imágenes aterradoras"},
  {n:87,d:"PSIC",l:"Algo serio anda mal en su cuerpo"},{n:88,d:"PSIC",l:"No sentirse cerca de otra persona"},
  {n:89,d:"add",l:"Sentirse culpable"},{n:90,d:"PSIC",l:"Algo anda mal en su mente"},
];

const SCL90_DIMS={
  SOM: {label:"Somatización",            n:12, color:"#c0506a", items:[1,4,12,27,40,42,48,49,52,53,56,58]},
  OC:  {label:"Obsesiones-Compulsiones", n:10, color:"#7c4a6e", items:[3,9,10,28,38,45,46,51,55,65]},
  SI:  {label:"Sensibilidad Interp.",    n:9,  color:"#3b6e8f", items:[6,21,34,36,37,41,61,69,73]},
  DEP: {label:"Depresión",               n:13, color:"#2d4a7a", items:[5,14,15,20,22,26,29,30,31,32,54,71,79]},
  ANS: {label:"Ansiedad",                n:10, color:"#8f5e3b", items:[2,17,23,33,39,57,72,78,80,86]},
  HOS: {label:"Hostilidad",              n:6,  color:"#c06030", items:[11,24,63,67,74,81]},
  FOB: {label:"Ansiedad Fóbica",         n:7,  color:"#6e3b7c", items:[13,25,47,50,70,75,82]},
  PAR: {label:"Ideación Paranoide",      n:6,  color:"#4a7c59", items:[8,18,43,68,76,83]},
  PSIC:{label:"Psicoticismo",            n:10, color:"#7c3b4a", items:[7,16,35,62,77,84,85,87,88,90]},
};

// Casullo & Pérez (1999/2008) — Adultos ARG 18-65 — media del ítem por dimensión
const SCL90_NORMS={
  M:{SOM:{m:0.46,sd:0.51},OC:{m:0.61,sd:0.58},SI:{m:0.44,sd:0.52},DEP:{m:0.51,sd:0.58},ANS:{m:0.40,sd:0.47},HOS:{m:0.48,sd:0.58},FOB:{m:0.20,sd:0.40},PAR:{m:0.59,sd:0.62},PSIC:{m:0.27,sd:0.40},IGS:{m:0.46,sd:0.47}},
  F:{SOM:{m:0.62,sd:0.57},OC:{m:0.72,sd:0.64},SI:{m:0.56,sd:0.58},DEP:{m:0.63,sd:0.64},ANS:{m:0.55,sd:0.52},HOS:{m:0.38,sd:0.52},FOB:{m:0.30,sd:0.48},PAR:{m:0.55,sd:0.58},PSIC:{m:0.29,sd:0.43},IGS:{m:0.54,sd:0.50}},
};

function sclRawToT(raw,dim,sex){
  const norm=SCL90_NORMS[sex]?.[dim];
  if(!norm||raw===null||isNaN(raw)) return null;
  return Math.round(50+10*(raw-norm.m)/norm.sd);
}
function classifySCL(t){
  if(t===null||t===undefined) return{label:"—",color:C.textLight};
  if(t>=73) return{label:"Muy elevado",color:C.danger};
  if(t>=63) return{label:"Clínicamente significativo",color:"#c06000"};
  if(t>=56) return{label:"Límite",color:C.warning};
  return{label:"Normal",color:C.success};
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── SRS DATA (Constantino 2002/2005) ────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// 65 ítems · Escala 1-4 (Nunca / A veces / Con frecuencia / Casi siempre)
// Ítems R (inversos): 9, 21, 36, 44, 54
// T-scores por sexo e informante (padre/madre vs docente)
// Cortes: T<60 Normal | T 60-65 Leve | T 66-75 Moderado | T≥76 Grave
// Para puntuaciones por subescala, consultar manual SRS

const SRS_ITEMS=[
  {n:1, R:false,l:"Es consciente de los sentimientos de los demás"},
  {n:2, R:false,l:"Tiende a hablar con personas que acaba de conocer"},
  {n:3, R:false,l:"Se expresa con facilidad cuando se le pregunta qué quiere"},
  {n:4, R:false,l:"Adapta su comportamiento a diferentes situaciones sociales"},
  {n:5, R:false,l:"Realiza comportamientos repetitivos (balanceo, aleteo, etc.)"},
  {n:6, R:false,l:"Parece absorto en sus propios pensamientos, desconectado"},
  {n:7, R:false,l:"Reconoce cuando algo está mal en una situación social"},
  {n:8, R:false,l:"Comprende que distintas situaciones requieren distintos comportamientos"},
  {n:9, R:true, l:"Se integra bien en juego grupal con otros niños/as ® "},
  {n:10,R:false,l:"Tiene dificultad para imitar el comportamiento de otros"},
  {n:11,R:false,l:"Evita iniciar contacto social"},
  {n:12,R:false,l:"Le cuesta descifrar las reglas no escritas de interacción"},
  {n:13,R:false,l:"Realiza movimientos o sonidos extraños e inapropiados"},
  {n:14,R:false,l:"Prefiere estar solo"},
  {n:15,R:false,l:"Muestra comportamientos repetitivos o rituales"},
  {n:16,R:false,l:"Está sintonizado con el humor del grupo"},
  {n:17,R:false,l:"Tiene problemas para entender el lenguaje figurado o metafórico"},
  {n:18,R:false,l:"Hace comentarios o preguntas fuera de lugar"},
  {n:19,R:false,l:"Le cuesta hacer amigos aunque lo intente"},
  {n:20,R:false,l:"Muestra intereses restringidos o conductas rituales"},
  {n:21,R:true, l:"Tiene habilidades sociales adecuadas para su edad ® "},
  {n:22,R:false,l:"Le resulta difícil entender lo que siente la gente"},
  {n:23,R:false,l:"Interrumpe conversaciones de forma inapropiada"},
  {n:24,R:false,l:"No está motivado a interactuar con sus pares"},
  {n:25,R:false,l:"Tiene intereses inusuales o muy específicos"},
  {n:26,R:false,l:"Muestra comportamientos inapropiados o raros ante otros"},
  {n:27,R:false,l:"No parece darse cuenta cuando los demás están molestos"},
  {n:28,R:false,l:"No comprende el humor de los otros"},
  {n:29,R:false,l:"Su lenguaje corporal no encaja con la situación"},
  {n:30,R:false,l:"No encuentra placer en interacciones sociales"},
  {n:31,R:false,l:"Tiene dificultad para reconocer expresiones faciales"},
  {n:32,R:false,l:"Le cuesta entender las intenciones de otras personas"},
  {n:33,R:false,l:"No puede mantener el hilo de una conversación"},
  {n:34,R:false,l:"Muestra poco interés en actividades de sus pares"},
  {n:35,R:false,l:"Se balancea, aletea o repite movimientos"},
  {n:36,R:true, l:"Inicia y mantiene el contacto visual apropiadamente ® "},
  {n:37,R:false,l:"Tiene dificultad para ver las cosas desde otra perspectiva"},
  {n:38,R:false,l:"Habla con voz monótona o entonación inusual"},
  {n:39,R:false,l:"No muestra interés en hacer actividades con otros"},
  {n:40,R:false,l:"Se preocupa excesivamente por ciertos objetos o temas"},
  {n:41,R:false,l:"Es retraído en situaciones sociales"},
  {n:42,R:false,l:"Tiene dificultad para distinguir chiste de sarcasmo"},
  {n:43,R:false,l:"Parece no comprender el propósito del contacto visual"},
  {n:44,R:true, l:"Se mezcla bien con los demás ® "},
  {n:45,R:false,l:"Interpreta el lenguaje figurado de forma demasiado literal"},
  {n:46,R:false,l:"Su conversación gira solo en torno a sus intereses"},
  {n:47,R:false,l:"Evita situaciones sociales aunque tenga la oportunidad"},
  {n:48,R:false,l:"Es inflexible ante cambios en rutinas o planes"},
  {n:49,R:false,l:"Se obsesiona con ciertos rituales o rutinas"},
  {n:50,R:false,l:"No puede interpretar el significado de expresiones faciales"},
  {n:51,R:false,l:"Le cuesta entender por qué algo afecta a los demás"},
  {n:52,R:false,l:"Presenta habilidades de comunicación inusuales"},
  {n:53,R:false,l:"Prefiere actividades solitarias a actividades grupales"},
  {n:54,R:true, l:"Tiene un sentido del humor apropiado ® "},
  {n:55,R:false,l:"Tiene intereses restringidos e inusuales que absorben su atención"},
  {n:56,R:false,l:"Le cuesta entender las motivaciones de los otros"},
  {n:57,R:false,l:"Habla excesivamente sobre temas de su interés"},
  {n:58,R:false,l:"Muestra poco interés en hacer amigos o mantener amistades"},
  {n:59,R:false,l:"Tiene dificultad para responder apropiadamente a señales sociales"},
  {n:60,R:false,l:"Le cuesta percibir las expectativas de los demás"},
  {n:61,R:false,l:"Sus expresiones faciales no coinciden con la situación"},
  {n:62,R:false,l:"No disfruta de las relaciones sociales"},
  {n:63,R:false,l:"No hace esfuerzo por comunicarse con sus pares"},
  {n:64,R:false,l:"No busca compañía de forma espontánea"},
  {n:65,R:false,l:"Insiste en seguir rutinas de manera inapropiada"},
];

// T-score norms (Constantino 2002/2005) por informante y sexo
// Media y DS del raw total (suma ítems ya revertidos)
const SRS_NORMS={
  parent:{M:{m:57.4,sd:18.5},F:{m:47.4,sd:15.8}},
  teacher:{M:{m:52.6,sd:19.5},F:{m:43.4,sd:17.0}},
};

function srsRawScore(data){
  let sum=0,count=0;
  SRS_ITEMS.forEach(item=>{
    const v=parseInt(data[item.n]);
    if(!isNaN(v)&&v>=1&&v<=4){
      sum+=item.R?5-v:v;
      count++;
    }
  });
  return count===65?sum:null;
}
function srsToT(raw,informant,sex){
  const norm=SRS_NORMS[informant]?.[sex];
  if(!norm||raw===null) return null;
  return Math.round(50+10*(raw-norm.m)/norm.sd);
}
function classifySRS(t){
  if(t===null||t===undefined) return{label:"—",color:C.textLight,desc:""};
  if(t>=76) return{label:"Grave",color:C.danger,desc:"Síntomas de TEA graves; comunicación social muy deficiente"};
  if(t>=66) return{label:"Moderado",color:"#c06000",desc:"Síntomas de TEA moderados; dificultades sociales significativas"};
  if(t>=60) return{label:"Leve",color:C.warning,desc:"Síntomas leves-moderados; posible TEA de alto funcionamiento"};
  return{label:"Normal",color:C.success,desc:"Sin indicadores clínicamente significativos de TEA"};
}

// ─── BADS NORMS (Farías Sarquís et al. 2021 ARG · N=115 · 18-85 años) ───────
// Sin diferencias significativas por sexo ni educación. Profile score total 0-24.
const BADS_NORMS={m:16.54,sd:4.02};
// Subtests individuales: Z = (raw_subtest - M_subtest) / SD_subtest (M≈2.75, SD≈0.70 por subtest)
const BADS_SUBTEST_NORMS={
  cambioReglas:{m:2.74,sd:0.70},programaAccion:{m:2.86,sd:0.63},busquedaLlave:{m:2.60,sd:0.81},
  juicioTemporal:{m:2.91,sd:0.60},mapaZoo:{m:2.72,sd:0.73},seisElementos:{m:2.67,sd:0.75},
};

// ─── PAPDI NORMS (Manoiloff et al. 2018 ARG) ─────────────────────────────────
// Prueba de denominación por imágenes · 30 ítems · denominación espontánea y guiada
const PAPDI_NORMS={
  "20-44":{uni:{m:27.8,sd:1.7},noUni:{m:26.5,sd:2.3}},
  "45-64":{uni:{m:27.2,sd:2.1},noUni:{m:25.8,sd:2.8}},
  "65+"  :{uni:{m:25.5,sd:3.0},noUni:{m:23.5,sd:3.5}},
};
function getPAPDIGroup(age){if(age<45)return"20-44";if(age<65)return"45-64";return"65+";}
function getPAPDIEd(educYears){return parseInt(educYears)>=12?"uni":"noUni";}

// ─── BNT NORMS ────────────────────────────────────────────────────────────────
// BNT-60: Allegri et al. (1997) ARG · por edad × escolaridad (Media y DS)
const BNT60_NORMS={
  "18-59":{high:{m:51.8,sd:7.2},low:{m:45.1,sd:9.3}},
  "60-79":{high:{m:47.5,sd:8.9},low:{m:38.6,sd:10.8}},
  "80+"  :{high:{m:42.0,sd:10.5},low:{m:32.0,sd:12.0}},
};
function getBNT60Group(age){if(age<60)return"18-59";if(age<80)return"60-79";return"80+";}
function getBNT60Ed(educYears){return parseInt(educYears)>=12?"high":"low";}
// BNT-12: Serrano & Allegri (2001) ARG · corte ≥9 · Sens 85% / Esp 94% para EA

function getHotelAgeGroup(age){
  if(age>=19&&age<=29) return "19-29";
  if(age>=30&&age<=39) return "30-39";
  if(age>=40&&age<=49) return "40-49";
  if(age>=50&&age<=59) return "50-59";
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── SCL-90-R FORM ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function SCL90Form({scl90Data,setScl90Data,patient}){
  const up=(k,v)=>setScl90Data(d=>({...d,[k]:v}));
  const sex=patient.sex?.includes("Mas")?"M":"F";

  // Cómputo
  const dimScores={};
  Object.keys(SCL90_DIMS).forEach(dk=>{
    const items=SCL90_DIMS[dk].items;
    const vals=items.map(n=>parseInt(scl90Data[n])).filter(v=>!isNaN(v));
    if(vals.length===items.length){
      const raw=parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(3));
      const t=sclRawToT(raw,dk,sex);
      dimScores[dk]={raw,t,cls:classifySCL(t)};
    } else dimScores[dk]=null;
  });

  const allDone=SCL90_ITEMS.every(i=>scl90Data[i.n]!==undefined&&scl90Data[i.n]!=="");
  const totalSum=allDone?SCL90_ITEMS.reduce((s,i)=>s+(parseInt(scl90Data[i.n])||0),0):null;
  const PST=allDone?SCL90_ITEMS.filter(i=>parseInt(scl90Data[i.n])>0).length:null;
  const IGS=totalSum!==null?parseFloat((totalSum/90).toFixed(3)):null;
  const PSDI=PST&&PST>0?parseFloat((totalSum/PST).toFixed(3)):null;
  const igsT=IGS!==null?sclRawToT(IGS,"IGS",sex):null;

  const itemsDone=SCL90_ITEMS.filter(i=>scl90Data[i.n]!==undefined&&scl90Data[i.n]!=="").length;

  return(
    <div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>📋 SCL-90-R — Inventario de Síntomas</h3>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:-28}}><ClearBtn onClear={()=>{setScl90Data({})}}/></div>
        <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Derogatis (1994) · Adaptación argentina: Casullo & Pérez (1999/2008) UBA/CONICET</p>
        <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 4px"}}>Escala 0 (Nada) — 1 (Un poco) — 2 (Moderado) — 3 (Bastante) — 4 (Mucho)</p>
        <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 16px"}}>Completá los 90 ítems. La tabla de resultados aparece debajo del cuestionario.</p>

        {/* CUESTIONARIO: ítems 1-90 en orden */}
        <div style={{border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",marginBottom:24}}>
          {SCL90_ITEMS.map((item,idx)=>{
            const val=scl90Data[item.n];
            return(
              <div key={item.n} style={{padding:"10px 16px",background:idx%2===0?"#fff":"#fdf6f7",borderBottom:idx<89?`1px solid ${C.border}`:"none",display:"flex",gap:12,alignItems:"flex-start"}}>
                <span style={{fontFamily:font,fontSize:13,fontWeight:700,color:C.textLight,minWidth:28,paddingTop:2}}>{item.n}.</span>
                <div style={{flex:1}}>
                  <div style={{fontFamily:font,fontSize:13,color:C.textDark,marginBottom:6,lineHeight:1.4}}>{item.l}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {[0,1,2,3,4].map(v=>(
                      <button key={v} onClick={()=>up(item.n,v)} style={{padding:"4px 14px",fontSize:12,fontFamily:font,borderRadius:6,cursor:"pointer",border:`2px solid ${val===v?C.primary:C.border}`,background:val===v?C.primary:"#fff",color:val===v?"#fff":C.textMid,fontWeight:val===v?700:400,minWidth:36}}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* TABLA RESUMEN — debajo del cuestionario */}
        <div style={{background:`${C.primary}06`,border:`2px solid ${C.primary}25`,borderRadius:12,padding:16}}>
          <div style={{fontFamily:font,fontSize:14,fontWeight:700,color:C.primary,marginBottom:4}}>Tabla de puntuaciones</div>
          <div style={{fontFamily:font,fontSize:12,color:C.textLight,marginBottom:12}}>
            {itemsDone<90?`${itemsDone}/90 ítems completados — la tabla se actualiza en tiempo real`:"90/90 ítems completados"}
          </div>

          <table style={{width:"100%",borderCollapse:"collapse",fontFamily:font,fontSize:13}}>
            <thead>
              <tr style={{background:C.primary,color:"white"}}>
                <th style={{padding:"9px 12px",textAlign:"left",fontWeight:700}}>Síntoma / Dimensión</th>
                <th style={{padding:"9px 12px",textAlign:"center"}}>Ítems</th>
                <th style={{padding:"9px 12px",textAlign:"center"}}>Media bruta</th>
                <th style={{padding:"9px 12px",textAlign:"center"}}>T-score</th>
                <th style={{padding:"9px 12px",textAlign:"left"}}>Significación</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(SCL90_DIMS).map(([dk,dd],idx)=>{
                const ds=dimScores[dk];
                const t=ds?.t??null;
                const cls=ds?.cls??null;
                return(
                  <tr key={dk} style={{background:idx%2===0?"#fff":"#faf5f6"}}>
                    <td style={{padding:"9px 12px",fontWeight:600,color:dd.color}}>{dd.label}</td>
                    <td style={{padding:"9px 12px",textAlign:"center",color:C.textLight,fontSize:11}}>{dd.items.join(", ")}</td>
                    <td style={{padding:"9px 12px",textAlign:"center",color:C.textMid}}>{ds&&ds.raw!==undefined?ds.raw.toFixed(2):<span style={{color:C.border}}>—</span>}</td>
                    <td style={{padding:"9px 12px",textAlign:"center",fontWeight:700,color:cls?.color??C.border}}>{t!==null&&t!==undefined?t:<span style={{color:C.border}}>—</span>}</td>
                    <td style={{padding:"9px 12px"}}>{cls?<span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span>:<span style={{color:C.border,fontSize:12}}>—</span>}</td>
                  </tr>
                );
              })}
              <tr style={{background:`${C.primary}12`,fontWeight:700,borderTop:`2px solid ${C.primary}30`}}>
                <td style={{padding:"10px 12px",color:C.primary}}>IGS — Índice Global de Severidad</td>
                <td style={{padding:"10px 12px",textAlign:"center",fontSize:11,color:C.textLight}}>1–90</td>
                <td style={{padding:"10px 12px",textAlign:"center"}}>{IGS!==null?IGS.toFixed(3):<span style={{color:C.border}}>—</span>}</td>
                <td style={{padding:"10px 12px",textAlign:"center",color:classifySCL(igsT)?.color??C.border}}>{igsT!==null&&igsT!==undefined?igsT:<span style={{color:C.border}}>—</span>}</td>
                <td style={{padding:"10px 12px"}}>{igsT?<span style={S.badge(classifySCL(igsT).color)}>{classifySCL(igsT).label}</span>:<span style={{color:C.border,fontSize:12}}>—</span>}</td>
              </tr>
              <tr style={{background:"#f5f5f5"}}>
                <td style={{padding:"9px 12px",color:C.textMid}}>PST — Total de síntomas positivos</td>
                <td style={{padding:"9px 12px",textAlign:"center",fontSize:11,color:C.textLight}}>1–90</td>
                <td style={{padding:"9px 12px",textAlign:"center",colSpan:3,color:C.textMid}}>{PST!==null?`${PST} / 90`:<span style={{color:C.border}}>—</span>}</td>
                <td/><td/>
              </tr>
              <tr style={{background:"#f5f5f5"}}>
                <td style={{padding:"9px 12px",color:C.textMid}}>PSDI — Intensidad síntomas positivos</td>
                <td style={{padding:"9px 12px",textAlign:"center",fontSize:11,color:C.textLight}}>1–90</td>
                <td style={{padding:"9px 12px",textAlign:"center",color:C.textMid}}>{PSDI!==null?PSDI.toFixed(3):<span style={{color:C.border}}>—</span>}</td>
                <td style={{padding:"9px 12px",textAlign:"center",fontSize:11,color:C.textLight}}>sin baremo ARG</td>
                <td/>
              </tr>
            </tbody>
          </table>
          <div style={{fontFamily:font,fontSize:11,color:C.textLight,marginTop:10}}>
            Corte clínico: T ≥ 63 = Clínicamente significativo · T ≥ 73 = Muy elevado · Normas argentinas por sexo: Casullo & Pérez (1999/2008)
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── SRS FORM ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function SRSForm({srsData,setSrsData}){
  const up=(k,v)=>setSrsData(d=>({...d,[k]:v}));
  const informant=srsData._informant||"parent";
  const sex=srsData._sex||"M";
  const srsScale=["1 — Nunca","2 — A veces","3 — Con frecuencia","4 — Casi siempre"];

  const raw=srsRawScore(srsData);
  const t=raw!==null?srsToT(raw,informant,sex):null;
  const cls=classifySRS(t);
  const itemsDone=SRS_ITEMS.filter(i=>srsData[i.n]!==undefined&&srsData[i.n]!=="").length;

  return(
    <div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>🔵 SRS — Escala de Responsividad Social</h3>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:-28}}><ClearBtn onClear={()=>{setSrsData({_informant:"parent",_sex:"M"})}}/></div>
        <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Constantino (2002/2005) · 65 ítems · Informante: padre/madre o docente</p>
        <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 16px"}}>Ítems marcados ® son inversos (se puntúan al revés). T-score por sexo e informante. Cortes: T&lt;60 Normal · T 60-65 Leve · T 66-75 Moderado · T≥76 Grave.</p>

        {/* Configuración */}
        <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:20}}>
          <div style={S.formGroup}>
            <label style={S.label}>Tipo de informante</label>
            <div style={{display:"flex",gap:8}}>
              {[{k:"parent",l:"Padre / Madre"},{k:"teacher",l:"Docente"}].map(opt=>(
                <button key={opt.k} onClick={()=>up("_informant",opt.k)} style={{padding:"7px 16px",borderRadius:8,border:`2px solid ${informant===opt.k?C.primary:C.border}`,background:informant===opt.k?C.primary:"#fff",color:informant===opt.k?"#fff":C.textMid,fontFamily:font,fontWeight:700,cursor:"pointer",fontSize:13}}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Sexo del niño/a evaluado/a</label>
            <div style={{display:"flex",gap:8}}>
              {[{k:"M",l:"Masculino"},{k:"F",l:"Femenino"}].map(opt=>(
                <button key={opt.k} onClick={()=>up("_sex",opt.k)} style={{padding:"7px 16px",borderRadius:8,border:`2px solid ${sex===opt.k?C.primary:C.border}`,background:sex===opt.k?C.primary:"#fff",color:sex===opt.k?"#fff":C.textMid,fontFamily:font,fontWeight:700,cursor:"pointer",fontSize:13}}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Resultado en tiempo real */}
        {raw!==null&&cls&&(
          <div style={{background:`${cls?cls.color:"transparent"}12`,border:`2px solid ${cls?cls.color+"40":C.border}`,borderRadius:12,padding:16,marginBottom:20,display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>TOTAL BRUTO</div>
              <div style={{fontSize:36,fontWeight:800,fontFamily:font,color:cls?cls.color:C.textLight}}>{raw}</div>
              <div style={{fontFamily:font,fontSize:11,color:C.textLight}}>rango 65-260</div>
            </div>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>T-SCORE</div>
              <div style={{fontSize:40,fontWeight:800,fontFamily:font,color:cls?cls.color:C.textLight}}>{t}</div>
              <span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span>
            </div>
            <div style={{flex:1,minWidth:220}}>
              <div style={{fontFamily:font,fontSize:14,fontWeight:700,color:cls?cls.color:C.textLight,marginBottom:4}}>{cls.desc}</div>
              <div style={{fontFamily:font,fontSize:12,color:C.textLight}}>
                Informante: {informant==="parent"?"Padre/Madre":"Docente"} · Sexo: {sex==="M"?"Masculino":"Femenino"}<br/>
                Norma (Constantino 2002): M={SRS_NORMS[informant][sex].m} DS={SRS_NORMS[informant][sex].sd}
              </div>
            </div>
          </div>
        )}
        {itemsDone>0&&raw===null&&(
          <div style={{fontFamily:font,fontSize:13,color:C.warning,marginBottom:16}}>⏳ {itemsDone}/65 ítems completados</div>
        )}

        {/* 65 ítems */}
        {SRS_ITEMS.map((item,idx)=>{
          const val=srsData[item.n];
          return(
            <div key={item.n} style={{padding:"8px 14px",background:idx%2===0?"#fff":"#fdf6f7",borderBottom:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"flex-start"}}>
              <span style={{fontFamily:font,fontSize:12,fontWeight:700,color:item.R?C.accent:C.textLight,minWidth:34}}>{item.n}.{item.R?"®":""}</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:font,fontSize:13,color:C.textDark,marginBottom:6}}>{item.l}</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {[1,2,3,4].map(v=>(
                    <button key={v} onClick={()=>up(item.n,v)} style={{padding:"3px 12px",fontSize:11,fontFamily:font,borderRadius:5,cursor:"pointer",border:`2px solid ${val===v?C.primary:C.border}`,background:val===v?C.primary:"#fff",color:val===v?"#fff":C.textMid,fontWeight:val===v?700:400}}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── WISC-V FORM ─────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function WISC5Form({wisc5Data,setWisc5Data,patient}){
  const up=(k,v)=>setWisc5Data(d=>({...d,[k]:v}));
  const get=(k)=>wisc5Data[k]!==""&&wisc5Data[k]!==undefined?parseFloat(wisc5Data[k]):null;

  // Subtest scaled scores (M=10 DS=3)
  const subVals={};
  WISC5_SUBTESTS.forEach(s=>{subVals[s.key]=get(s.key);});

  // Index composite scores (M=100 DS=15)
  const indexVals={};
  WISC5_INDEXES.forEach(i=>{indexVals[i.key]=get(i.key);});

  const catColors={"CIT":C.primary,"Primaria":C.dark,"Complementaria":C.textLight};
  const domColors={"ICV":"#4a7c6e","IVE":"#3b6e8f","IRF":"#7c6e3b","IMT":"#6e3b7c","IVP":"#7c3b4a","IRC":"#8f5e3b"};

  const principalIdx=WISC5_INDEXES.filter(i=>i.type==="principal");
  const secondaryIdx=WISC5_INDEXES.filter(i=>i.type==="secundario");

  // Discrepancias entre índices principales
  const discrepancies=[];
  const pairs=[["ICV","IVE"],["ICV","IRF"],["ICV","IMT"],["ICV","IVP"],["IVE","IRF"],["IVE","IMT"],["IVE","IVP"],["IRF","IMT"],["IRF","IVP"],["IMT","IVP"]];
  pairs.forEach(([a,b])=>{
    const va=indexVals[a],vb=indexVals[b];
    if(va!==null&&vb!==null){
      const diff=Math.abs(va-vb);
      if(diff>=15) discrepancies.push({a,b,diff,sig:diff>=23?"p<.01":diff>=15?"p<.05":null});
    }
  });

  return(
    <div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>🧩 WISC-V — Escala de Inteligencia Wechsler para Niños V</h3>
        <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Wechsler (2017) · Adaptación Chile: Rosas & Pizarro (NCS Pearson) · Rango 6:0–16:11 años</p>
        <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 16px"}}>Ingresá los puntajes escalares de subpruebas (M=10 DS=3) y los índices compuestos (M=100 DS=15) desde el protocolo de registro. Las tablas de conversión bruto→escalar están en el Apéndice A del manual técnico.</p>

        {/* SUBPRUEBAS */}
        <div style={{fontFamily:font,fontSize:14,fontWeight:700,color:C.primary,marginBottom:12}}>Puntajes escalares de subpruebas (1–19)</div>
        {["CIT","Primaria","Complementaria"].map(cat=>(
          <div key={cat} style={{marginBottom:16}}>
            <div style={{background:cat==="CIT"?C.primary:cat==="Primaria"?C.dark:C.textLight,color:"white",padding:"6px 14px",borderRadius:"6px 6px 0 0",fontWeight:700,fontFamily:font,fontSize:12}}>
              {cat==="CIT"?"Subpruebas primarias — CIT":cat==="Primaria"?"Subpruebas primarias — no CIT":"Subpruebas complementarias"}
            </div>
            <div style={{border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 8px 8px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))"}}>
              {WISC5_SUBTESTS.filter(s=>s.cat===cat).map((s,idx)=>{
                const bruto=subVals[s.key];
                const ageYrs=Math.min(Math.max(parseInt(patient&&patient.age)||10,6),16);
                const pe=bruto!==null?wisc5BrutoToPE(bruto,s.key,ageYrs):null;
                const val=pe;
                const clr=domColors[s.domain]||C.primary;
                const z=pe!==null?parseFloat(((pe-10)/3).toFixed(2)):null;
                const cls=classifyZ(z);
                return(
                  <div key={s.key} style={{padding:"10px 14px",background:idx%2===0?"#fff":"#fdf6f7",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                      <span style={{fontFamily:font,fontSize:13,color:C.textDark,fontWeight:600}}>{s.label}</span>
                      <span style={{fontSize:11,fontFamily:font,fontWeight:700,color:clr}}>{s.abbr} — {s.domain}</span>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <div>
                        <div style={{fontSize:9,color:C.textLight,fontFamily:font,marginBottom:2}}>Puntaje bruto</div>
                        <input type="number" min={0} style={{...S.input,width:70,textAlign:"center"}} value={wisc5Data[s.key]||""} onChange={e=>up(s.key,e.target.value)} placeholder="bruto"/>
                      </div>
                      {val!==null&&cls&&<span style={{...S.badge(cls?cls.color:C.textLight),fontSize:11}}>Z={z>0?"+":""}{z} — {cls?cls.label:"—"}</span>}
                    </div>
                    {val!==null&&(
                      <div style={{height:4,background:C.border,borderRadius:2,marginTop:6,overflow:"hidden"}}>
                        <div style={{width:`${Math.min((val/19)*100,100)}%`,height:"100%",background:clr,borderRadius:2}}/>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* ÍNDICES PRINCIPALES */}
        <div style={{fontFamily:font,fontSize:14,fontWeight:700,color:C.primary,marginTop:20,marginBottom:12}}>Índices principales y CIT (M=100 DS=15)</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12,marginBottom:20}}>
          {principalIdx.map(idx=>{
            const val=indexVals[idx.key];
            const cls=val!==null?classifyWISC5(val):null;
            const pct=val!==null?wisc5Pct(val):null;
            const ci=val!==null?wisc5CI(val,WISC5_SEM[idx.key]):null;
            return(
              <div key={idx.key} style={{border:`2px solid ${val!==null?(cls?.color+"40"):C.border}`,borderRadius:12,padding:14}}>
                <div style={{fontFamily:font,fontSize:12,fontWeight:700,color:C.textMid,marginBottom:6}}>
                  {idx.label} <span style={{fontWeight:400,color:C.textLight}}>({idx.abbr})</span>
                </div>
                <div style={{fontFamily:font,fontSize:11,color:C.textLight,marginBottom:8}}>
                  Subpruebas: {idx.subtests.join(" + ")}
                </div>
                <input type="number" min={40} max={160} style={{...S.input,textAlign:"center",fontSize:18,fontWeight:700}} value={wisc5Data[idx.key]||""} onChange={e=>up(idx.key,e.target.value)} placeholder="40–160"/>
                {val!==null&&cls&&(
                  <div style={{marginTop:8}}>
                    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{fontFamily:font,fontSize:15,fontWeight:800,color:cls?cls.color:C.textLight}}>{val}</span>
                      <span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span>
                      {pct!==null&&<span style={{fontFamily:font,fontSize:12,color:C.textLight}}>P{pct}</span>}
                    </div>
                    {ci&&<div style={{fontFamily:font,fontSize:12,color:C.textLight,marginTop:4}}>IC 95%: {ci.lo}–{ci.hi}</div>}
                    <div style={{height:5,background:C.border,borderRadius:3,marginTop:6,overflow:"hidden"}}>
                      <div style={{width:`${Math.min(Math.max((val-40)/120*100,0),100)}%`,height:"100%",background:cls?cls.color:C.textLight,borderRadius:3}}/>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ÍNDICES SECUNDARIOS */}
        <div style={{fontFamily:font,fontSize:14,fontWeight:700,color:C.dark,marginBottom:12}}>Índices secundarios (opcionales)</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10,marginBottom:20}}>
          {secondaryIdx.map(idx=>{
            const val=indexVals[idx.key];
            const cls=val!==null?classifyWISC5(val):null;
            const pct=val!==null?wisc5Pct(val):null;
            return(
              <div key={idx.key} style={{border:`1px solid ${C.border}`,borderRadius:10,padding:12}}>
                <div style={{fontFamily:font,fontSize:12,fontWeight:700,color:C.textMid,marginBottom:4}}>{idx.label} ({idx.abbr})</div>
                <div style={{fontFamily:font,fontSize:11,color:C.textLight,marginBottom:6}}>{idx.subtests.join(" + ")}</div>
                <input type="number" min={40} max={160} style={{...S.input,textAlign:"center"}} value={wisc5Data[idx.key]||""} onChange={e=>up(idx.key,e.target.value)} placeholder="40–160"/>
                {val!==null&&cls&&(
                  <div style={{display:"flex",gap:6,marginTop:6,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{fontFamily:font,fontSize:14,fontWeight:700,color:cls?cls.color:C.textLight}}>{val}</span>
                    <span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span>
                    {pct!==null&&<span style={{fontFamily:font,fontSize:11,color:C.textLight}}>P{pct}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* DISCREPANCIAS */}
        {discrepancies.length>0&&(
          <div>
            <div style={{fontFamily:font,fontSize:14,fontWeight:700,color:C.primary,marginBottom:10}}>Discrepancias significativas entre índices principales (≥15 puntos)</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {discrepancies.map(d=>(
                <div key={d.a+d.b} style={{background:`${C.danger}12`,border:`1px solid ${C.danger}40`,borderRadius:8,padding:"8px 14px",fontFamily:font,fontSize:12}}>
                  <strong style={{color:C.danger}}>{d.a} vs {d.b}</strong>: diferencia de {d.diff} puntos
                  <span style={{...S.badge(C.danger),marginLeft:6}}>{d.sig}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── BADS FORM ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function BADSForm({badsData,setBadsData}){
  const up=(k,v)=>setBadsData(d=>({...d,[k]:v}));
  const total=BADS_SUBTESTS.reduce((s,t)=>{const v=parseFloat(badsData[t.key]);return s+(isNaN(v)?0:v);},0);
  const allDone=BADS_SUBTESTS.every(t=>badsData[t.key]!==undefined&&badsData[t.key]!=="");
  const z=allDone?parseFloat(((total-BADS_NORMS.m)/BADS_NORMS.sd).toFixed(2)):null;
  const cls=classifyZ(z);
  return(
    <div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>🧪 BADS — Evaluación Conductual del Síndrome Disejecutivo</h3>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:-28}}><ClearBtn onClear={()=>{setBadsData({})}}/></div>
        <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Wilson et al. (1996) · Normas argentinas: Farías Sarquís et al. (2021) · N=115 · 18-85 años</p>
        <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 16px"}}>6 subtests · Puntaje perfil 0-4 por subtest · Total 0-24 · Z-score respecto a normas ARG</p>
        {allDone&&(
          <div style={{background:`${cls?cls.color:"transparent"}12`,border:`2px solid ${cls?cls.color+"40":C.border}`,borderRadius:12,padding:14,marginBottom:20,display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
            <div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>TOTAL PERFIL</div><div style={{fontSize:40,fontWeight:800,fontFamily:font,color:cls?cls.color:C.textLight}}>{total}/24</div></div>
            <div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>Z-SCORE ARG</div><div style={{fontSize:32,fontWeight:800,fontFamily:font,color:cls?cls.color:C.textLight}}>{z>0?"+":""}{z}</div><span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span></div>
            <div style={{fontFamily:font,fontSize:12,color:C.textLight}}>M={BADS_NORMS.m} DS={BADS_NORMS.sd} · Farías Sarquís et al. (2021)<br/>Corte disfunción ejecutiva: Z ≤ -1.5</div>
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
          {BADS_SUBTESTS.map(st=>{
            const val=badsData[st.key];
            const sn=BADS_SUBTEST_NORMS[st.key];
            const sz=val!==undefined&&val!==""?parseFloat(((parseFloat(val)-sn.m)/sn.sd).toFixed(2)):null;
            const scls=classifyZ(sz);
            return(
              <div key={st.key} style={{border:`2px solid ${val!==undefined?scls?scls.color:C.textLight+"50":C.border}`,borderRadius:10,padding:12}}>
                <div style={{fontFamily:font,fontSize:13,fontWeight:700,color:C.textMid,marginBottom:8}}>{st.label} <span style={{fontWeight:400,color:C.textLight}}>/ {st.max}</span></div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                  {[0,1,2,3,4].map(v=>(
                    <button key={v} onClick={()=>up(st.key,v)} style={{padding:"5px 12px",fontSize:13,fontFamily:font,borderRadius:6,cursor:"pointer",border:`2px solid ${parseFloat(val)===v?C.primary:C.border}`,background:parseFloat(val)===v?C.primary:"#fff",color:parseFloat(val)===v?"#fff":C.textMid,fontWeight:parseFloat(val)===v?700:400}}>{v}</button>
                  ))}
                </div>
                {sz!==null&&<div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{fontFamily:font,fontSize:12}}>Z={sz>0?"+":""}{sz}</span><span style={S.badge(scls?scls.color:C.textLight)}>{scls.label}</span></div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── FIGURA COMPLEJA DE REY FORM ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function ReyForm({reyData,setReyData}){
  const up=(k,v)=>setReyData(d=>({...d,[k]:v}));
  const copia=reyData.copia!==""&&reyData.copia!==undefined?parseFloat(reyData.copia):null;
  const memoria=reyData.memoria!==""&&reyData.memoria!==undefined?parseFloat(reyData.memoria):null;
  const copiaPC=copia!==null?reyScoreToPc(copia,REY_COPIA_PC):null;
  const memoriaPC=memoria!==null?reyScoreToPc(memoria,REY_MEMORIA_PC):null;
  const retencion=copia!==null&&memoria!==null&&copia>0?parseFloat((memoria/copia*100).toFixed(1)):null;
  const tipos=["I — Copia estructurada","II — Detalles sobre contorno","III — Contorno general","IV — Yuxtaposición de detalles","V — Con detalles separados","VI — Sin estructura reconocible","VII — Similar a diseño"];
  return(
    <div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>🔷 Figura Compleja de Rey</h3>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:-28}}><ClearBtn onClear={()=>{setReyData({copia:"",memoria:"",tipo:""})}}/></div>
        <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Rey (1941/1994) · Baremos: TEA Ediciones (1994) · Adultos 15+ años · Score 0-36</p>
        <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 16px"}}>Copia y reproducción de memoria diferida de una figura compleja.</p>
        <div style={S.grid2}>
          {[{k:"copia",label:"Puntaje Copia (0-36)",pc:copiaPC},{k:"memoria",label:"Puntaje Memoria diferida (0-36)",pc:memoriaPC}].map(f=>{
            const v=reyData[f.k];
            const pc=f.pc;
            const pctColor=pc>=50?C.success:pc>=25?C.warning:C.danger;
            return(
              <div key={f.k} style={{border:`2px solid ${C.border}`,borderRadius:12,padding:14}}>
                <label style={S.label}>{f.label}</label>
                <input type="number" min={0} max={36} style={{...S.input,fontSize:18,fontWeight:700,textAlign:"center"}} value={v||""} onChange={e=>up(f.k,e.target.value)} placeholder="0 – 36"/>
                {pc!==null&&(
                  <div style={{marginTop:8,display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontFamily:font,fontSize:16,fontWeight:800,color:pctColor}}>P{pc}</span>
                    <span style={S.badge(pctColor)}>{pc>=75?"Superior":pc>=50?"Promedio":pc>=25?"Bajo el promedio":"Deteriorado"}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{...S.grid2,marginTop:12}}>
          <div style={{border:`2px solid ${C.border}`,borderRadius:12,padding:14}}>
            <label style={S.label}>Tipo de construcción (I–VII)</label>
            <select style={S.select} value={reyData.tipo||""} onChange={e=>up("tipo",e.target.value)}>
              <option value="">— Seleccioná —</option>
              {tipos.map((t,i)=><option key={i} value={i+1}>{t}</option>)}
            </select>
          </div>
          {retencion!==null&&(
            <div style={{border:`2px solid ${C.border}`,borderRadius:12,padding:14,display:"flex",flexDirection:"column",justifyContent:"center"}}>
              <div style={{fontFamily:font,fontSize:12,fontWeight:700,color:C.textLight,marginBottom:4}}>Índice de Retención</div>
              <div style={{fontSize:36,fontWeight:800,fontFamily:font,color:retencion>=75?C.success:retencion>=50?C.warning:C.danger}}>{retencion}%</div>
              <div style={{fontFamily:font,fontSize:11,color:C.textLight}}>= Memoria / Copia × 100 · P{memoriaPC} vs P{copiaPC}</div>
              <span style={S.badge(retencion>=75?C.success:retencion>=50?C.warning:C.danger)}>{retencion>=75?"Buena retención":retencion>=50?"Retención moderada":"Pérdida significativa"}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── SNAP-IV FORM ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function SNAPForm({snapData,setSnapData}){
  const up=(k,v)=>setSnapData(d=>({...d,[k]:v}));
  const scale=["0 — Nunca","1 — Pocas veces","2 — Bastante","3 — Muchas veces"];
  const DA_items=SNAP_ITEMS.filter(i=>i.sub==="DA");
  const HI_items=SNAP_ITEMS.filter(i=>i.sub==="HI");
  const ODD_items=SNAP_ITEMS.filter(i=>i.sub==="ODD");
  const sumDA=DA_items.reduce((s,i)=>s+(parseInt(snapData[i.num])||0),0);
  const sumHI=HI_items.reduce((s,i)=>s+(parseInt(snapData[i.num])||0),0);
  const sumODD=ODD_items.reduce((s,i)=>s+(parseInt(snapData[i.num])||0),0);
  const meanDA=parseFloat((sumDA/DA_items.length).toFixed(2));
  const meanHI=parseFloat((sumHI/HI_items.length).toFixed(2));
  const daDone=DA_items.every(i=>snapData[i.num]!==undefined);
  const hiDone=HI_items.every(i=>snapData[i.num]!==undefined);
  const oddDone=ODD_items.every(i=>snapData[i.num]!==undefined);
  const daPos=daDone&&(sumDA>=SNAP_CUTOFFS.DA.sumCut||meanDA>=SNAP_CUTOFFS.DA.indexCut);
  const hiPos=hiDone&&(sumHI>=SNAP_CUTOFFS.HI.sumCut||meanHI>=SNAP_CUTOFFS.HI.indexCut);
  const subtype=daPos&&hiPos?"TDAH Combinado":daPos?"TDAH Predominantemente Inatento":hiPos?"TDAH Predominantemente Hiperactivo-Impulsivo":"Sin perfil TDAH";

  const renderGroup=(label,items,sum,mean,cutoffs,done,pos,color)=>(
    <div style={{marginBottom:16}}>
      <div style={{background:color,color:"white",padding:"8px 16px",borderRadius:"8px 8px 0 0",fontWeight:700,fontFamily:font,fontSize:13,display:"flex",justifyContent:"space-between"}}>
        <span>{label}</span>
        {done&&<span>Suma={sum} · Media={mean} — {pos?<>⚠ Supera corte ({cutoffs.indexCut})</>:<>Por debajo del corte</>}</span>}
      </div>
      <div style={{border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 8px 8px"}}>
        {items.map((item,idx)=>{
          const val=snapData[item.num];
          return(
            <div key={item.num} style={{padding:"8px 14px",background:idx%2===0?"#fff":"#fdf6f7",borderBottom:idx<items.length-1?`1px solid ${C.border}`:"none",display:"flex",gap:10,alignItems:"flex-start"}}>
              <span style={{fontFamily:font,fontSize:12,fontWeight:700,color:C.textLight,minWidth:28,paddingTop:2}}>{item.num}.</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:font,fontSize:13,color:C.textDark,marginBottom:6}}>{item.text}</div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {[0,1,2,3].map(v=>(
                    <button key={v} onClick={()=>up(item.num,v)} style={{padding:"3px 10px",fontSize:11,fontFamily:font,borderRadius:5,cursor:"pointer",border:`2px solid ${val===v?color:C.border}`,background:val===v?color:"#fff",color:val===v?"#fff":C.textMid,fontWeight:val===v?700:400}}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return(
    <div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>⚡ SNAP-IV — Escala de TDAH</h3>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:-28}}><ClearBtn onClear={()=>{setSnapData({})}}/></div>
        <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Swanson (1992) · Validación argentina: Grañana et al. (2011) · Heteroinforme (padres/docentes)</p>
        <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 16px"}}>Escala 0-3 por ítem. Cortes Buenos Aires (Grañana 2011): DA ≥1.66 media, HI ≥1.77 media.</p>
        {(daDone||hiDone)&&(
          <div style={{background:`${daPos||hiPos?C.danger:C.success}15`,border:`2px solid ${daPos||hiPos?C.danger:C.success}40`,borderRadius:12,padding:14,marginBottom:20,display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
            {[{label:"DA",sum:sumDA,mean:meanDA,cut:SNAP_CUTOFFS.DA,done:daDone,pos:daPos},{label:"HI",sum:sumHI,mean:meanHI,cut:SNAP_CUTOFFS.HI,done:hiDone,pos:hiPos},{label:"ODD",sum:sumODD,mean:null,cut:null,done:oddDone,pos:sumODD>=6}].map(s=>(
              <div key={s.label} style={S.indexBox}>
                <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>{s.label}</div>
                <div style={{fontSize:28,fontWeight:800,fontFamily:font,color:s.pos?C.danger:C.success}}>{s.sum}</div>
                {s.mean!==null&&<div style={{fontFamily:font,fontSize:12}}>Media={s.mean}</div>}
                {s.done&&<span style={S.badge(s.pos?C.danger:C.success)}>{s.pos?"Positivo":"Negativo"}</span>}
              </div>
            ))}
            {(daDone&&hiDone)&&<div style={{fontFamily:font,fontSize:14,fontWeight:700,color:daPos||hiPos?C.danger:C.success,flex:1}}>{subtype}</div>}
          </div>
        )}
        {renderGroup("DA — Déficit de Atención (ítems 1-9)",DA_items,sumDA,meanDA,SNAP_CUTOFFS.DA,daDone,daPos,C.primary)}
        {renderGroup("HI — Hiperactividad-Impulsividad (ítems 11-19)",HI_items,sumHI,meanHI,SNAP_CUTOFFS.HI,hiDone,hiPos,"#6d28d9")}
        {renderGroup("ODD — Trastorno Negativista Desafiante (ítems 21-28)",ODD_items,sumODD,null,null,oddDone,sumODD>=6,"#b45309")}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── PAPDI FORM ──────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function PAPDIForm({papdiData,setPapdiData,patient}){
  const up=(k,v)=>setPapdiData(d=>({...d,[k]:v}));
  const age=parseInt(patient.age)||0;
  const educYears=patient.educYears||"0";
  const group=getPAPDIGroup(age);
  const edKey=getPAPDIEd(educYears);
  const norm=group?PAPDI_NORMS[group]?.[edKey]:null;
  const libre=papdiData.libre!==""&&papdiData.libre!==undefined?parseFloat(papdiData.libre):null;
  const guiada=papdiData.guiada!==""&&papdiData.guiada!==undefined?parseFloat(papdiData.guiada):null;
  const zLibre=norm&&libre!==null?parseFloat(((libre-norm.m)/norm.sd).toFixed(2)):null;
  const clsLibre=classifyZ(zLibre);
  const anomia=zLibre!==null&&zLibre<=-1.5;
  return(
    <div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>🖼 PAPDI — Denominación por Imágenes</h3>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:-28}}><ClearBtn onClear={()=>{setPapdiData({libre:"",guiada:""})}}/></div>
        <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Manoiloff et al. (2018) · Normas argentinas · Denominación espontánea y guiada</p>
        <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 16px"}}>30 ítems · Denominación espontánea (libre) = nombra sin ayuda. Guiada = con pista fonológica. Corte anomia: Z ≤ -1.5.</p>
        {norm&&<div style={{background:`${C.primary}08`,borderRadius:8,padding:10,marginBottom:16,fontFamily:font,fontSize:12,color:C.textMid}}>Baremo: {group} años · {edKey==="uni"?"universitaria":"no universitaria"} · M={norm.m} DS={norm.sd}</div>}
        <div style={S.grid2}>
          {[{k:"libre",label:"Denominación espontánea / libre (0-30)",max:30,note:"Nombra sin ayuda"},
            {k:"guiada",label:"Denominación guiada (0-30)",max:30,note:"Con pista fonológica (primera sílaba)"}].map(f=>(
            <div key={f.k} style={{border:`2px solid ${C.border}`,borderRadius:12,padding:14}}>
              <label style={S.label}>{f.label}</label>
              <div style={{fontFamily:font,fontSize:11,color:C.textLight,marginBottom:6}}>{f.note}</div>
              <input type="number" min={0} max={f.max} style={{...S.input,fontSize:18,fontWeight:700,textAlign:"center"}} value={papdiData[f.k]||""} onChange={e=>up(f.k,e.target.value)} placeholder={`0 – ${f.max}`}/>
            </div>
          ))}
        </div>
        {libre!==null&&norm&&(
          <div style={{background:`${anomia?C.danger:C.success}12`,border:`2px solid ${anomia?C.danger:C.success}40`,borderRadius:12,padding:14,marginTop:12,display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
            <div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>SCORE LIBRE</div><div style={{fontSize:36,fontWeight:800,fontFamily:font,color:clsLibre.color}}>{libre}/30</div></div>
            <div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>Z-SCORE</div><div style={{fontSize:32,fontWeight:800,fontFamily:font,color:clsLibre.color}}>{zLibre>0?"+":""}{zLibre}</div><span style={S.badge(clsLibre.color)}>{clsLibre.label}</span></div>
            <div style={{fontFamily:font,fontSize:14,fontWeight:700,color:anomia?C.danger:C.success}}>{anomia?"⚠ ANOMIA PRESENTE (Z ≤ -1.5)":"✅ Sin indicadores de anomia"}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── BNT FORM ────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function BNTForm({bntData,setBntData,patient}){
  const up=(k,v)=>setBntData(d=>({...d,[k]:v}));
  const mode=bntData.mode||"60";
  const age=parseInt(patient.age)||0;
  const educYears=patient.educYears||"0";
  const ageGroup=getBNT60Group(age);
  const edKey=getBNT60Ed(educYears);
  const norm=ageGroup&&mode==="60"?BNT60_NORMS[ageGroup]?.[edKey]:null;
  const score=bntData.score!==""&&bntData.score!==undefined?parseFloat(bntData.score):null;
  const maxScore=mode==="60"?60:12;
  const z60=norm&&score!==null?parseFloat(((score-norm.m)/norm.sd).toFixed(2)):null;
  const cls60=classifyZ(z60);
  const bnt12Cut=score!==null&&mode==="12"&&score<9;
  return(
    <div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>🏷 BNT — Boston Naming Test</h3>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:-28}}><ClearBtn onClear={()=>{setBntData({mode:"60",score:""})}}/></div>
        <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Kaplan et al. · BNT-60: Allegri et al. (1997) ARG · BNT-12: Serrano & Allegri (2001) ARG</p>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {["60","12"].map(m=>(
            <button key={m} onClick={()=>up("mode",m)} style={{padding:"7px 20px",borderRadius:8,border:`2px solid ${mode===m?C.primary:C.border}`,background:mode===m?C.primary:"#fff",color:mode===m?"#fff":C.textMid,fontFamily:font,fontWeight:700,cursor:"pointer",fontSize:13}}>BNT-{m}</button>
          ))}
        </div>
        {mode==="60"&&norm&&<div style={{background:`${C.primary}08`,borderRadius:8,padding:10,marginBottom:12,fontFamily:font,fontSize:12,color:C.textMid}}>Baremo: {ageGroup} años · {edKey==="high"?"≥12 años educación":"&lt;12 años educación"} · M={norm.m} DS={norm.sd} · Allegri et al. (1997)</div>}
        {mode==="12"&&<div style={{background:`${C.primary}08`,borderRadius:8,padding:10,marginBottom:12,fontFamily:font,fontSize:12,color:C.textMid}}>Corte: ≥9 normal · &lt;9 positivo para anomia · Sensibilidad 85% / Especificidad 94% para EA · Serrano & Allegri (2001)</div>}
        <div style={S.formGroup}>
          <label style={S.label}>Puntaje BNT-{mode} (0–{maxScore})</label>
          <input type="number" min={0} max={maxScore} style={{...S.input,fontSize:22,fontWeight:700,textAlign:"center",maxWidth:160}} value={bntData.score||""} onChange={e=>up("score",e.target.value)} placeholder={`/ ${maxScore}`}/>
        </div>
        {score!==null&&(
          <div style={{marginTop:12}}>
            {mode==="60"&&z60!==null&&(
              <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                <div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>SCORE</div><div style={{fontSize:34,fontWeight:800,fontFamily:font,color:cls60.color}}>{score}/60</div></div>
                <div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>Z-SCORE</div><div style={{fontSize:30,fontWeight:800,fontFamily:font,color:cls60.color}}>{z60>0?"+":""}{z60}</div><span style={S.badge(cls60.color)}>{cls60.label}</span></div>
              </div>
            )}
            {mode==="12"&&(
              <div style={{display:"flex",gap:12,alignItems:"center"}}>
                <div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>SCORE</div><div style={{fontSize:36,fontWeight:800,fontFamily:font,color:bnt12Cut?C.danger:C.success}}>{score}/12</div></div>
                <div style={{fontFamily:font,fontSize:14,fontWeight:700,color:bnt12Cut?C.danger:C.success}}>{bnt12Cut?"⚠ Por debajo del corte (< 9) — indicador de anomia":"✅ Dentro del rango normal (≥ 9)"}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── CARAS-R FORM ────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// ─── ATENCIÓN WAIS / WMS FORM ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// Retención de Dígitos (RD) y Claves (CLA) del WAIS-IV — PE escalar → Z=(PE-10)/3
// Secuencia Número-Letra (SLN) del WMS-III — PE escalar → Z=(PE-10)/3
// Clinician ingresa la Puntuación Escalar (PE) leída del protocolo de corrección

const WAIS_ATTEN_AGE_GROUPS=["16-17","18-19","20-24","25-29","30-34","35-44","45-54","55-64","65-69","70-74","75-79","80-84","85-90"];
const WMS3_ATTEN_GROUPS=["16-19","20-34","35-54","55-74","75-89"];

function WAISAttenForm({waisAttenData,setWaisAttenData,patient}){
  const up=(k,v)=>setWaisAttenData(d=>({...d,[k]:v}));
  const g=(k)=>waisAttenData[k]!==undefined&&waisAttenData[k]!==""?parseFloat(waisAttenData[k]):null;

  // PE → Z = (PE - 10) / 3  (escala estándar subpruebas Wechsler)
  const zFromPE=(pe)=>pe!==null?parseFloat(((pe-10)/3).toFixed(2)):null;

  // PE y Z calculados desde brutos (ver calcRdPE, calcClaPE, calcSlnPE abajo)

  const waisAg=waisAttenData.waisGroup||"";
  // Brutos
  const rdBruto=waisAttenData.rdBruto,claBruto=waisAttenData.claBruto,slnBruto=waisAttenData.slnBruto;
  // PE calculados desde bruto
  const calcRdPE=waisAg?waisBrutoToPE(waisAttenData.rdBruto,"rd",waisAg):null;
  const calcClaPE=waisAg?waisBrutoToPE(waisAttenData.claBruto,"cla",waisAg):null;
  const calcSlnPE=waisAttenData.wmsGroup?waisBrutoToPE(waisAttenData.slnBruto,"sln",waisAg||"20-24"):null;
  const calcZRD=calcRdPE!==null?parseFloat(((calcRdPE-10)/3).toFixed(2)):null;
  const calcZCLA=calcClaPE!==null?parseFloat(((calcClaPE-10)/3).toFixed(2)):null;
  const calcZSLN=calcSlnPE!==null?parseFloat(((calcSlnPE-10)/3).toFixed(2)):null;

  const SubtestRow=({abbr,fullName,brutoKey,maxBruto,pe,zVal,description})=>{
    const bruto=waisAttenData[brutoKey];
    const cls=zVal!==null?classifyZ(zVal):null;
    return(
      <div style={{background:"#fff",borderRadius:10,padding:"14px 16px",border:`1.5px solid ${cls&&zVal<=-1?C.danger+"50":C.border}`}}>
        <div style={{marginBottom:8}}>
          <span style={{fontFamily:font,fontSize:11,fontWeight:800,color:C.primary,letterSpacing:"0.06em",textTransform:"uppercase"}}>{abbr} · </span>
          <span style={{fontFamily:font,fontSize:13,fontWeight:700,color:C.textDark}}>{fullName}</span>
        </div>
        <div style={{fontFamily:font,fontSize:11,color:C.textLight,marginBottom:10,fontStyle:"italic"}}>{description}</div>
        <div style={{display:"flex",gap:12,alignItems:"flex-end"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:9,fontWeight:700,color:C.textLight,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:4}}>Puntaje Bruto (0–{maxBruto})</div>
            <input type="number" min={0} max={maxBruto} style={{...S.input}} value={bruto||""} onChange={e=>up(brutoKey,e.target.value)} placeholder={`0–${maxBruto}`}/>
          </div>
          {pe!==null&&cls&&(
            <div style={{textAlign:"center",minWidth:80,padding:"8px 10px",background:C.bg,borderRadius:8}}>
              <div style={{fontSize:9,fontWeight:700,color:C.textLight,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:4}}>PE · Z</div>
              <div style={{fontSize:22,fontWeight:800,color:cls?cls.color:C.textLight}}>{pe}</div>
              <div style={{fontSize:12,fontWeight:700,color:cls?cls.color:C.textLight}}>{zVal>0?"+":""}{zVal}</div>
              <span style={{...S.badge(cls?cls.color:C.textLight),fontSize:9,marginTop:4}}>{cls?cls.label:"—"}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return(
    <div>
      {/* Bloque WAIS-IV */}
      <div style={S.card}>
        <div style={{borderLeft:`4px solid ${C.primary}`,paddingLeft:14,marginBottom:16}}>
          <div style={{fontFamily:font,fontSize:16,fontWeight:700,color:C.textDark}}>Retención de Dígitos y Claves · WAIS-IV</div>
          <div style={{fontFamily:font,fontSize:12,color:C.textLight,marginTop:3}}>
            Baremos WAIS-IV (adaptación chilena, Rosas & Pizarro). Ingresá el puntaje bruto; PE y Z se calculan según el grupo etario. Verificar con el manual oficial.
          </div>
        </div>
        {patient.name&&(
          <div style={{display:"flex",gap:24,marginBottom:16,padding:"10px 14px",background:C.bg,borderRadius:8}}>
            <div><div style={{fontFamily:font,fontSize:10,fontWeight:700,color:C.textLight,textTransform:"uppercase",letterSpacing:"0.05em"}}>Paciente</div><div style={{fontFamily:font,fontSize:13,fontWeight:600}}>{patient.name}</div></div>
            {patient.date&&<div><div style={{fontFamily:font,fontSize:10,fontWeight:700,color:C.textLight,textTransform:"uppercase",letterSpacing:"0.05em"}}>Fecha de evaluación</div><div style={{fontFamily:font,fontSize:13,fontWeight:600}}>{patient.date}</div></div>}
          </div>
        )}
        <div style={{marginBottom:16}}>
          <label style={{...S.label,textTransform:"uppercase",letterSpacing:"0.05em",fontSize:10}}>Grupo etario WAIS-IV</label>
          <select style={{...S.select,maxWidth:220}} value={waisAg} onChange={e=>up("waisGroup",e.target.value)}>
            <option value="">— Seleccioná el grupo —</option>
            {WAIS_ATTEN_AGE_GROUPS.map(g=><option key={g} value={g}>{g} años</option>)}
          </select>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
          <SubtestRow abbr="RD" fullName="Retención de Dígitos" brutoKey="rdBruto" maxBruto={48} pe={calcRdPE} zVal={calcZRD}
            description="Memoria de trabajo auditiva verbal. Retención y manipulación de secuencias de dígitos."/>
          <SubtestRow abbr="CLA" fullName="Claves" brutoKey="claBruto" maxBruto={135} pe={calcClaPE} zVal={calcZCLA}
            description="Velocidad de procesamiento. Copia de símbolos asociados a dígitos en tiempo limitado."/>
        </div>
      </div>

      {/* Bloque WMS-III */}
      <div style={S.card}>
        <div style={{borderLeft:`4px solid ${C.primary}`,paddingLeft:14,marginBottom:16}}>
          <div style={{fontFamily:font,fontSize:16,fontWeight:700,color:C.textDark}}>Secuencia Número-Letra · WMS-III</div>
          <div style={{fontFamily:font,fontSize:12,color:C.textLight,marginTop:3}}>
            Baremos WMS-III (Tablas D.1–D.6). Ingresá el puntaje bruto; PE y Z se calculan automáticamente.
          </div>
        </div>
        <div style={{marginBottom:16}}>
          <label style={{...S.label,textTransform:"uppercase",letterSpacing:"0.05em",fontSize:10}}>Grupo etario WMS-III</label>
          <select style={{...S.select,maxWidth:220}} value={waisAttenData.wmsGroup||""} onChange={e=>up("wmsGroup",e.target.value)}>
            <option value="">— Seleccioná el grupo —</option>
            {WMS3_ATTEN_GROUPS.map(g=><option key={g} value={g}>{g} años</option>)}
          </select>
        </div>
        <SubtestRow abbr="SLN" fullName="Secuencia Número-Letra" brutoKey="slnBruto" maxBruto={30} pe={calcSlnPE} zVal={calcZSLN}
          description="Memoria de trabajo y atención alternante. Series de letras y números a reordenar."/>
      </div>
    </div>
  );
}

function CarasForm({carasData,setCarasData}){
  const up=(k,v)=>setCarasData(d=>({...d,[k]:v}));
  const grade=carasData.grade||"";
  const norm=grade?CARAS_NORMS[grade]:null;
  const A=carasData.A!==""&&carasData.A!==undefined?parseFloat(carasData.A):null;
  const E=carasData.E!==""&&carasData.E!==undefined?parseFloat(carasData.E):null;
  const AE=(A!==null&&E!==null)?A-E:null;
  const ICI=(A!==null&&E!==null&&(A+E)>0)?parseFloat(((A-E)/(A+E)*100).toFixed(1)):null;
  const zA=norm&&A!==null?parseFloat(((A-norm.A.m)/norm.A.sd).toFixed(2)):null;
  const zE=norm&&E!==null?parseFloat(((E-norm.E.m)/norm.E.sd).toFixed(2)):null;
  const zAE=norm&&AE!==null?parseFloat(((AE-norm.AE.m)/norm.AE.sd).toFixed(2)):null;
  const eneatipo=zAE!==null?getEneatipo(zAE):null;
  const clsAE=classifyZ(zAE);
  return(
    <div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>👁 CARAS-R — Test de Percepción de Diferencias</h3>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:-28}}><ClearBtn onClear={()=>{setCarasData({grade:"",A:"",E:""})}}/></div>
        <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Thurstone & Yela · TEA Ediciones · Baremos Argentina (varones y mujeres combinados)</p>
        <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 16px"}}>3 minutos · 60 ítems · Tachar las 3 caras distintas en cada fila de 6. A=aciertos · E=errores · A-E=puntuación principal.</p>
        <div style={{...S.grid2,marginBottom:16}}>
          <div style={S.formGroup}>
            <label style={S.label}>Grado escolar</label>
            <select style={S.select} value={grade} onChange={e=>up("grade",e.target.value)}>
              <option value="">— Seleccioná el grado —</option>
              {Object.entries(CARAS_NORMS).map(([k,v])=>(
                <option key={k} value={k}>{v.label} ({v.age} años) — N={v.n}</option>
              ))}
            </select>
          </div>
          {norm&&<div style={{background:`${C.primary}08`,borderRadius:10,padding:12,fontFamily:font,fontSize:12,color:C.textMid}}>
            <strong>Baremo:</strong> {norm.label} · {norm.age} años · N={norm.n}<br/>
            A-E: M={norm.AE.m} DE={norm.AE.sd} · A: M={norm.A.m} DE={norm.A.sd}
          </div>}
        </div>
        <div style={S.grid2}>
          {[{k:"A",label:"Aciertos (A) — targets tachados correctamente",max:60},{k:"E",label:"Errores (E) — distractores tachados incorrectamente",max:60}].map(f=>(
            <div key={f.k} style={S.formGroup}>
              <label style={S.label}>{f.label}</label>
              <input type="number" min={0} max={f.max} style={S.input} value={carasData[f.k]||""} onChange={e=>up(f.k,e.target.value)} placeholder={`0 – ${f.max}`}/>
            </div>
          ))}
        </div>
        {AE!==null&&(
          <div style={{display:"flex",gap:16,flexWrap:"wrap",marginTop:8}}>
            {[
              {label:"A-E",val:AE,z:zAE,cls:clsAE,desc:"Puntuación principal",inv:false},
              {label:"A",val:A,z:zA,cls:classifyZ(zA),desc:"Velocidad / aciertos",inv:false},
              {label:"E",val:E,z:zE,cls:classifyZ(zE?-zE:null),desc:"Errores (menor=mejor)",inv:true},
            ].map(s=>(
              <div key={s.label} style={{...S.indexBox,flex:1,minWidth:140}}>
                <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>{s.label} — {s.desc}</div>
                <div style={{fontSize:32,fontWeight:800,fontFamily:font,color:s.cls?s.cls.color:C.primary}}>{s.val}</div>
                {norm&&s.z!==null&&<>
                  <div style={{fontSize:13,fontFamily:font}}>Z={s.z>0?"+":""}{s.z}</div>
                  <span style={S.badge(s.cls?s.cls.color:C.textLight)}>{s.cls?s.cls.label:"—"}</span>
                </>}
              </div>
            ))}
            <div style={{...S.indexBox,flex:1,minWidth:140}}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>ICI — Índice Control Impulsividad</div>
              <div style={{fontSize:28,fontWeight:800,fontFamily:font,color:ICI>=80?C.success:ICI>=60?C.warning:C.danger}}>{ICI}%</div>
              <div style={{fontSize:11,color:C.textLight,fontFamily:font}}>ICI = (A−E)/(A+E)×100</div>
            </div>
            {norm&&eneatipo!==null&&(
              <div style={{...S.indexBox,flex:1,minWidth:120}}>
                <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>ENEATIPO A-E</div>
                <div style={{fontSize:40,fontWeight:800,fontFamily:font,color:eneatipo>=7?C.success:eneatipo>=4?C.warning:C.danger}}>{eneatipo}</div>
                <div style={{fontSize:11,color:C.textLight,fontFamily:font}}>Escala 1-9 (M=5)</div>
              </div>
            )}
          </div>
        )}
        {!norm&&<div style={{background:`${C.warning}15`,border:`1px solid ${C.warning}`,borderRadius:8,padding:10,marginTop:12,fontFamily:font,fontSize:13,color:C.warning}}>⚠ Seleccioná el grado escolar para ver los baremos.</div>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── d2 FORM ─────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function D2Form({d2Data,setD2Data,patient}){
  const up=(k,v)=>setD2Data(d=>({...d,[k]:v}));
  const g=(k)=>d2Data[k]!==undefined&&d2Data[k]!==""?parseFloat(d2Data[k]):null;
  const TR=g("TR"),O=g("O"),COM=g("C"),TRp=g("TRp"),TRm=g("TRm");
  // Calculados automáticamente
  const TA=(TR!==null&&O!==null&&COM!==null)?Math.max(TR-O-COM,0):null;
  const CON=(TA!==null&&COM!==null)?TA-COM:null;
  const VAR=(TRp!==null&&TRm!==null)?TRp-TRm:null;
  const Epct=(TR!==null&&TR>0&&O!==null&&COM!==null)?parseFloat(((O+COM)/TR*100).toFixed(1)):null;

  // Z vs Bates & Lemay (2004)
  const zTA=TA!==null?parseFloat(((TA-D2_NORMS.totCorr.m)/D2_NORMS.totCorr.sd).toFixed(2)):null;
  const zCON=CON!==null?parseFloat(((CON-D2_NORMS.conc.m)/D2_NORMS.conc.sd).toFixed(2)):null;
  const zO=O!==null?parseFloat((-(O-D2_NORMS.oErr.m)/D2_NORMS.oErr.sd).toFixed(2)):null;
  const zC=COM!==null?parseFloat((-(COM-D2_NORMS.cErr.m)/D2_NORMS.cErr.sd).toFixed(2)):null;
  const zVAR=VAR!==null?parseFloat((-(VAR-D2_NORMS.fluct.m)/D2_NORMS.fluct.sd).toFixed(2)):null;

  const FieldLabel=({abbr,name,desc,range})=>(
    <div style={{marginBottom:4}}>
      <div style={{display:"flex",alignItems:"baseline",gap:6}}>
        <span style={{fontFamily:font,fontSize:11,fontWeight:800,color:C.primary,letterSpacing:"0.05em"}}>{abbr} ·</span>
        <span style={{fontFamily:font,fontSize:11,fontWeight:700,color:C.textDark,letterSpacing:"0.04em",textTransform:"uppercase"}}>{name}</span>
      </div>
      <div style={{fontFamily:font,fontSize:10,color:C.textLight,marginTop:2}}>{desc}</div>
    </div>
  );

  const fields=[
    {k:"TR",abbr:"TR",name:"Total de respuestas",desc:"Suma de todos los elementos intentados en las 14 filas",range:"0–658",max:658},
    {k:"O", abbr:"O", name:"Omisiones",          desc:'Letras "d" con dos rayitas que NO fueron marcadas',    range:"0–299",max:299},
    {k:"C", abbr:"C", name:"Comisiones",          desc:'Letras irrelevantes ("p" o "d" sin dos rayitas) que SÍ fueron marcadas',range:"0–299",max:299},
    {k:"TRp",abbr:"TR+",name:"Línea con más intentos",desc:"Nº de elementos intentados en la fila donde el paciente llegó más lejos",range:"0–47",max:47},
    {k:"TRm",abbr:"TR–",name:"Línea con menos intentos",desc:"Nº de elementos intentados en la fila donde el paciente llegó menos lejos",range:"0–47",max:47},
  ];

  return(
    <div>
      <div style={S.card}>
        <div style={{borderBottom:`1px solid ${C.border}`,paddingBottom:14,marginBottom:20}}>
          <h3 style={{...S.sectionTitle,marginBottom:4}}>d2 · Test de Atención</h3>
          <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:0}}>Brickenkamp (1962/1994) · Referencia normativa: Bates & Lemay (2004) — 28-32 años, N=364 EEUU</p>
        </div>

        {/* Datos del paciente (solo lectura) */}
        {patient.name&&(
          <div style={{background:`${C.bg}`,borderRadius:10,padding:"12px 16px",marginBottom:20,display:"flex",gap:32}}>
            <div><div style={{fontFamily:font,fontSize:10,fontWeight:700,color:C.textLight,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:3}}>Paciente</div><div style={{fontFamily:font,fontSize:14,fontWeight:600,color:C.textDark}}>{patient.name}</div></div>
            {patient.date&&<div><div style={{fontFamily:font,fontSize:10,fontWeight:700,color:C.textLight,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:3}}>Fecha de evaluación</div><div style={{fontFamily:font,fontSize:14,fontWeight:600,color:C.textDark}}>{patient.date}</div></div>}
            {patient.age&&<div><div style={{fontFamily:font,fontSize:10,fontWeight:700,color:C.textLight,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:3}}>Edad (años)</div><div style={{fontFamily:font,fontSize:14,fontWeight:600,color:C.textDark}}>{patient.age}</div></div>}
          </div>
        )}

        {/* Puntajes brutos */}
        <div style={{marginBottom:20}}>
          <div style={{fontFamily:font,fontSize:14,fontWeight:700,color:C.textDark,marginBottom:4}}>Puntajes brutos</div>
          <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 16px"}}>Completá los valores que se leen directamente del protocolo corregido (segunda hoja del ejemplar autocorregible, luego de separar las dos hojas).</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
            {fields.map(f=>(
              <div key={f.k}>
                <FieldLabel abbr={f.abbr} name={f.name} desc={f.desc} range={f.range}/>
                <input type="number" min={0} max={f.max} style={{...S.input,marginTop:4}} value={d2Data[f.k]||""} onChange={e=>up(f.k,e.target.value)} placeholder={f.range}/>
              </div>
            ))}
          </div>
        </div>

        {/* Calculados + Resultados */}
        {TR!==null&&(
          <div>
            <div style={{fontFamily:font,fontSize:14,fontWeight:700,color:C.textDark,marginBottom:14}}>Puntajes derivados</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12}}>
              {[
                {abbr:"TA",name:"Total de aciertos",val:TA,formula:"TR − O − C",z:zTA,high:true},
                {abbr:"CON",name:"Concentración",val:CON,formula:"TA − C",z:zCON,high:true},
                {abbr:"VAR",name:"Variación",val:VAR,formula:"TR+ − TR−",z:zVAR,high:false},
                {abbr:"E%",name:"% de error",val:Epct!==null?Epct+"%":null,formula:"(O+C)/TR×100",z:null,high:false},
              ].map(s=>{
                const cls=classifyZ(s.z);
                return(
                  <div key={s.abbr} style={{background:`${C.bg}`,borderRadius:10,padding:"12px 14px",border:`1px solid ${s.z!==null&&s.z<=-1?C.danger+"40":C.border}`}}>
                    <div style={{fontFamily:font,fontSize:10,fontWeight:700,color:C.textLight,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:6}}>{s.abbr} · {s.name}</div>
                    <div style={{fontFamily:font,fontSize:10,color:C.textLight,marginBottom:8,fontStyle:"italic"}}>{s.formula}</div>
                    <div style={{fontSize:28,fontWeight:800,fontFamily:font,color:cls?cls.color:C.textDark}}>{s.val!==null?s.val:"—"}</div>
                    {s.z!==null&&cls&&<div style={{marginTop:6}}>
                      <div style={{fontFamily:font,fontSize:12}}>Z = {s.z>0?"+":""}{s.z}</div>
                      <span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span>
                    </div>}
                  </div>
                );
              })}
            </div>
            <div style={{fontFamily:font,fontSize:10,color:C.textLight,marginTop:12}}>
              ⚠ Normas de referencia: Bates & Lemay (2004) — muestra estadounidense 28-32 años. Para otras edades consultar Brickenkamp & Zillmer (1998).
            </div>
          </div>
        )}
        <ClinicalInterpBlock testId="d2" results={{d2:{TR,TA,O,C:COM,VAR,CON,Epct,zTA,zCON,zO}}} patient={patient} source="Bates & Lemay (2004). Construct validity of the d2. Neuropsychological Rehabilitation, 14."/>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
          <ClearBtn onClear={()=>setD2Data({})}/>
        </div>
      </div>
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// ─── NEUROPSI FORM ───────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function NeuropsiForm({neuropsiData,setNeuropsiData}){
  const up=(k,v)=>setNeuropsiData(d=>({...d,[k]:v}));
  const domainOrder=["Orientación","Atención","Codificación","Lenguaje","FE","Motoras","Evocación"];
  const domainLabels={"FE":"Funciones Ejecutivas","Motoras":"Funciones Motoras"};

  const domainTotals={};
  const domainMaxes={};
  domainOrder.forEach(dom=>{
    const subs=NEUROPSI_SUBTESTS.filter(s=>s.domain===dom);
    domainMaxes[dom]=subs.reduce((a,s)=>a+s.max,0);
    domainTotals[dom]=subs.reduce((a,s)=>a+(parseInt(neuropsiData[s.key])||0),0);
  });
  const totalScore=Object.values(domainTotals).reduce((a,b)=>a+b,0);
  const anyData=NEUROPSI_SUBTESTS.some(s=>neuropsiData[s.key]!==undefined&&neuropsiData[s.key]!=="");

  return(
    <div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>🔬 NEUROPSI — Evaluación Neuropsicológica Breve</h3>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:-28}}><ClearBtn onClear={()=>{setNeuropsiData({})}}/></div>
        <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Ostrosky-Solís et al. · Normas argentinas: Querejeta et al. (2017) · Fe de erratas: 2019</p>
        <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 4px"}}>Screening cognitivo multidimensional · Total máx: 122 puntos · Duración: 25-30 min</p>
        <div style={{background:`${C.warning}12`,border:`1px solid ${C.warning}40`,borderRadius:8,padding:10,marginBottom:16,fontFamily:font,fontSize:12,color:C.warning}}>
          ⚠ Los Z-scores y percentiles requieren la tabla completa de Querejeta et al. (2017) por edad y educación. Este formulario calcula puntajes brutos y totales por dominio.
        </div>

        {anyData&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:10,marginBottom:20}}>
            <div style={{...S.indexBox,border:`2px solid ${C.primary}30`}}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>TOTAL NEUROPSI</div>
              <div style={{fontSize:38,fontWeight:800,fontFamily:font,color:C.primary}}>{totalScore}/122</div>
              <div style={{fontSize:11,color:C.textLight,fontFamily:font}}>({Math.round(totalScore/1.22)}%)</div>
            </div>
            {domainOrder.map(dom=>{
              const pct=domainMaxes[dom]>0?Math.round(domainTotals[dom]/domainMaxes[dom]*100):0;
              const color=pct>=80?C.success:pct>=60?C.warning:C.danger;
              const info=NEUROPSI_DOMAINS[dom];
              return(
                <div key={dom} style={{...S.indexBox,minWidth:120}}>
                  <div style={{fontSize:10,fontWeight:700,color:info.color,fontFamily:font}}>{domainLabels[dom]||dom}</div>
                  <div style={{fontSize:26,fontWeight:800,fontFamily:font,color}}>{domainTotals[dom]}/{domainMaxes[dom]}</div>
                  <div style={{height:5,background:C.border,borderRadius:3,marginTop:6,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:info.color,borderRadius:3}}/></div>
                </div>
              );
            })}
          </div>
        )}

        {domainOrder.map(dom=>{
          const subs=NEUROPSI_SUBTESTS.filter(s=>s.domain===dom);
          const info=NEUROPSI_DOMAINS[dom];
          const domTotal=domainTotals[dom];
          const domMax=domainMaxes[dom];
          return(
            <div key={dom} style={{marginBottom:16}}>
              <div style={{background:info.color,color:"white",padding:"8px 16px",borderRadius:"8px 8px 0 0",fontWeight:700,fontFamily:font,fontSize:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>{domainLabels[dom]||dom}</span>
                <span style={{fontSize:13,opacity:0.9}}>{domTotal}/{domMax}</span>
              </div>
              <div style={{border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 8px 8px"}}>
                {subs.map((sub,idx)=>{
                  const val=neuropsiData[sub.key];
                  const pct=val!==""&&val!==undefined?Math.round(parseInt(val)/sub.max*100):null;
                  return(
                    <div key={sub.key} style={{padding:"10px 16px",background:idx%2===0?"#fff":"#fdf6f7",borderBottom:`1px solid ${C.border}`,display:"flex",gap:12,alignItems:"center"}}>
                      <div style={{flex:1}}>
                        <div style={{fontFamily:font,fontSize:13,color:C.textDark}}>{sub.label}</div>
                        <div style={{fontFamily:font,fontSize:11,color:C.textLight}}>máx: {sub.max} puntos</div>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <input type="number" min={0} max={sub.max} style={{...S.input,width:70,textAlign:"center"}} value={val||""} onChange={e=>up(sub.key,e.target.value)} placeholder={`/  ${sub.max}`}/>
                        {pct!==null&&(
                          <div style={{width:50,textAlign:"right"}}>
                            <span style={{fontFamily:font,fontSize:12,fontWeight:700,color:pct>=80?C.success:pct>=60?C.warning:C.danger}}>{pct}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── WURS FORM ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function WURSForm({wursData,setWursData,wursMode,setWursMode}){
  const allItems=wursMode==="25"?WURS25_ITEMS:[...WURS25_ITEMS,...WURS61_EXTRA_ITEMS].sort((a,b)=>a.num-b.num);
  const scale=[0,1,2,3,4];
  const scaleLabels=["Nada (0)","Un poco (1)","Moderadamente (2)","Bastante (3)","Mucho (4)"];

  // Compute score
  const score25=WURS25_ITEMS.reduce((s,item)=>s+(parseInt(wursData[item.num])||0),0);
  const isDone25=WURS25_ITEMS.every(item=>wursData[item.num]!==undefined);
  const z25=isDone25?parseFloat(((score25-WURS_NORM_ARG.mean)/WURS_NORM_ARG.sd).toFixed(2)):null;
  const pct25=isDone25?wursPercentile(score25):null;

  // 5 factores (solo en modo 61)
  const factorScores={};
  if(wursMode==="61"){
    Object.entries(WURS61_FACTORS).forEach(([fk,fd])=>{
      const vals=fd.items.map(n=>parseInt(wursData[n])||0);
      factorScores[fk]={mean:(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2),sum:vals.reduce((a,b)=>a+b,0)};
    });
  }

  const cutScandar=score25>=36.5;
  const cutWard=score25>=46;

  return(
    <div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>🔎 WURS — Wender Utah Rating Scale</h3>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:-28}}><ClearBtn onClear={()=>{setWursData({})}}/></div>
        <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Ward, Wender & Reimherr (1993) · Validación ARG: Scandar (2021) · Versión española: Rodríguez-Jiménez et al. (2001)</p>
        <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 16px"}}>Escala retrospectiva de síntomas de TDAH en la infancia. Responder: «De pequeño yo era / tenía / estaba...»</p>

        {/* Toggle 25/61 */}
        <div style={{display:"flex",gap:8,marginBottom:20,alignItems:"center"}}>
          <span style={{fontFamily:font,fontSize:13,fontWeight:700,color:C.textMid}}>Versión:</span>
          {["25","61"].map(m=>(
            <button key={m} onClick={()=>setWursMode(m)} style={{padding:"7px 20px",borderRadius:8,border:`2px solid ${wursMode===m?C.primary:C.border}`,background:wursMode===m?C.primary:"#fff",color:wursMode===m?"#fff":C.textMid,fontFamily:font,fontWeight:700,cursor:"pointer",fontSize:13}}>
              WURS-{m}
            </button>
          ))}
          <span style={{fontFamily:font,fontSize:12,color:C.textLight,marginLeft:8}}>
            {wursMode==="25"?"25 ítems de mayor valor discriminante para TDAH":"61 ítems completos · calcula 5 factores (Gift et al. 2021)"}
          </span>
        </div>

        {/* Puntuación en tiempo real */}
        {isDone25&&(
          <div style={{background:`${C.primary}10`,border:`2px solid ${C.primary}30`,borderRadius:12,padding:16,marginBottom:20,display:"flex",flexWrap:"wrap",gap:16,alignItems:"center"}}>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>PUNTAJE WURS-25</div>
              <div style={{fontSize:38,fontWeight:800,fontFamily:font,color:cutScandar?C.danger:C.success}}>{score25}/100</div>
            </div>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>PERCENTIL ARG (18-50)</div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:font,color:C.primary}}>P{pct25}</div>
              <div style={{fontSize:11,color:C.textLight,fontFamily:font}}>Scandar (2021)</div>
            </div>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>Z (pob. general ARG)</div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:font,color:z25>1.2?C.danger:C.success}}>{z25>0?"+":""}{z25}</div>
              <div style={{fontSize:11,color:C.textLight,fontFamily:font}}>M=23.5 DE=13.16</div>
            </div>
            <div style={{flex:1,minWidth:200}}>
              <div style={{fontFamily:font,fontSize:13,marginBottom:8}}>
                <strong>Corte Scandar (ARG, esp. 90%):</strong>{" "}
                <span style={{color:cutScandar?C.danger:C.success,fontWeight:700}}>{cutScandar?"≥ 36.5 ✓ Sugestivo de TDAH infantil":"< 36.5 — No supera corte"}</span>
              </div>
              <div style={{fontFamily:font,fontSize:13}}>
                <strong>Corte Ward (1993, N/A):</strong>{" "}
                <span style={{color:cutWard?C.danger:C.textLight,fontWeight:700}}>{cutWard?"≥ 46 ✓ Positivo":"< 46 — Negativo"}</span>
              </div>
              <div style={{fontFamily:font,fontSize:11,color:C.textLight,marginTop:6}}>Muestra clínica TDAH ARG: M=34.5 DE=11.1 · Sens 90% = ≥14.5 · Esp 90% = ≥36.5</div>
            </div>
          </div>
        )}

        {/* Factores WURS-61 */}
        {wursMode==="61"&&Object.keys(factorScores).length>0&&(
          <div style={{marginBottom:20}}>
            <div style={{fontFamily:font,fontSize:13,fontWeight:700,color:C.textMid,marginBottom:8}}>5 Factores — Gift et al. (2021) (media de ítems, rango 0-4)</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {Object.entries(WURS61_FACTORS).map(([fk,fd])=>{
                const fs=factorScores[fk];
                const val=parseFloat(fs?.mean)||0;
                const color=val>=2?C.danger:val>=1.5?C.warning:C.success;
                return(
                  <div key={fk} style={{...S.indexBox,minWidth:150}}>
                    <div style={{fontSize:10,fontWeight:700,color:C.textLight,fontFamily:font,marginBottom:4}}>{fk}: {fd.label}</div>
                    <div style={{fontSize:24,fontWeight:800,fontFamily:font,color}}>{fs?.mean}</div>
                    <div style={{fontSize:10,color:C.textLight,fontFamily:font}}>Σ={fs?.sum} ({fd.items.length} ítems)</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Ítems */}
        <div>
          {allItems.map((item,idx)=>{
            const val=wursData[item.num];
            const isW25=WURS25_ITEMS.some(i=>i.num===item.num);
            return(
              <div key={item.num} style={{padding:"10px 14px",background:idx%2===0?"#fff":"#fdf6f7",borderBottom:`1px solid ${C.border}`,borderRadius:idx===0?"8px 8px 0 0":idx===allItems.length-1?"0 0 8px 8px":"0"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <span style={{fontSize:11,fontWeight:700,fontFamily:font,color:C.textLight,minWidth:24}}>{item.num}.</span>
                  {isW25&&wursMode==="61"&&<span style={{fontSize:10,background:`${C.primary}20`,color:C.primary,borderRadius:4,padding:"1px 6px",fontFamily:font,fontWeight:700}}>W25</span>}
                  <span style={{fontFamily:font,fontSize:13,color:C.textDark}}>{item.label}</span>
                </div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap",paddingLeft:32}}>
                  {scale.map(v=>(
                    <button key={v} onClick={()=>setWursData(d=>({...d,[item.num]:v}))} style={{padding:"4px 10px",fontSize:11,fontFamily:font,borderRadius:6,cursor:"pointer",border:`2px solid ${val===v?C.primary:C.border}`,background:val===v?C.primary:"#fff",color:val===v?"#fff":C.textMid,fontWeight:val===v?700:400}}>
                      {v} — {scaleLabels[v].split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── ASRS FORM ───────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function ASRSForm({asrsData,setAsrsData}){
  const iItems=ASRS_ITEMS.filter(i=>i.factor==="I");
  const hItems=ASRS_ITEMS.filter(i=>i.factor==="H");
  const scoreI=iItems.reduce((s,i)=>s+(parseInt(asrsData[i.num])||0),0);
  const scoreH=hItems.reduce((s,i)=>s+(parseInt(asrsData[i.num])||0),0);
  const scoreT=scoreI+scoreH;
  const isDone=ASRS_ITEMS.every(i=>asrsData[i.num]!==undefined);

  const pctT=isDone?asrsPercentile(scoreT,ASRS_PERCENTILES_T):null;
  const pctI=isDone?asrsPercentile(scoreI,ASRS_PERCENTILES_I):null;
  const pctH=isDone?asrsPercentile(scoreH,ASRS_PERCENTILES_H):null;

  // Z respecto a población general ARG
  const zT=isDone?parseFloat(((scoreT-30.22)/10.70).toFixed(2)):null;
  const zI=isDone?parseFloat(((scoreI-15.22)/5.61).toFixed(2)):null;
  const zH=isDone?parseFloat(((scoreH-14.96)/6.25).toFixed(2)):null;

  // Comparación con muestra clínica TDAH
  const distT=isDone?parseFloat(((46-scoreT)/9.8).toFixed(2)):null; // cuántas DE debajo de la media clínica

  const renderGroup=(label,items,scoreVal,pctVal,zVal,color)=>(
    <div style={{marginBottom:20}}>
      <div style={{background:color,color:"white",padding:"8px 16px",borderRadius:"8px 8px 0 0",fontWeight:700,fontFamily:font,fontSize:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>{label}</span>
        {isDone&&<span style={{fontSize:12,opacity:0.9}}>Σ={scoreVal}/36 · P{pctVal} · Z={zVal>0?"+":""}{zVal}</span>}
      </div>
      <div style={{border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 8px 8px"}}>
        {items.map((item,idx)=>(
          <div key={item.num} style={{padding:"10px 16px",background:idx%2===0?"#fff":"#fdf6f7",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontFamily:font,fontSize:13,color:C.textDark,marginBottom:8}}><strong>{item.num}.</strong> {item.label}</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {ASRS_SCALE.map((lbl,val)=>(
                <button key={val} onClick={()=>setAsrsData(d=>({...d,[item.num]:val}))} style={{padding:"5px 10px",fontSize:11,fontFamily:font,borderRadius:6,cursor:"pointer",border:`2px solid ${asrsData[item.num]===val?color:C.border}`,background:asrsData[item.num]===val?color:"#fff",color:asrsData[item.num]===val?"white":C.textMid,fontWeight:asrsData[item.num]===val?700:400}}>
                  {val} — {lbl}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return(
    <div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>📋 ASRS v1.1 — Adult ADHD Self-Report Scale</h3>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:-28}}><ClearBtn onClear={()=>{setAsrsData({})}}/></div>
        <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Kessler et al. (2005) / OMS · Validación ARG: Scandar (2021) · Sintomatología actual de TDAH</p>
        <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 16px"}}>18 ítems · Escala 0 (Nunca) a 4 (Muy a menudo) · Rango total 0-72</p>

        {isDone&&(
          <div style={{background:`${C.primary}10`,border:`2px solid ${C.primary}30`,borderRadius:12,padding:16,marginBottom:20,display:"flex",flexWrap:"wrap",gap:16,alignItems:"center"}}>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>ASRS TOTAL</div>
              <div style={{fontSize:38,fontWeight:800,fontFamily:font,color:pctT>=75?C.danger:C.success}}>{scoreT}/72</div>
              <div style={{fontSize:13,fontFamily:font}}>P{pctT} · Z={zT>0?"+":""}{zT}</div>
            </div>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>INATENCIÓN</div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:font,color:pctI>=75?C.danger:C.success}}>{scoreI}/36</div>
              <div style={{fontSize:12,fontFamily:font}}>P{pctI} · Z={zI>0?"+":""}{zI}</div>
            </div>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>HIPERACTIVIDAD</div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:font,color:pctH>=75?C.danger:C.success}}>{scoreH}/36</div>
              <div style={{fontSize:12,fontFamily:font}}>P{pctH} · Z={zH>0?"+":""}{zH}</div>
            </div>
            <div style={{flex:1,minWidth:220}}>
              <div style={{fontFamily:font,fontSize:13,marginBottom:6}}>
                <strong>Población general ARG:</strong> M=30.2 DE=10.7
              </div>
              <div style={{fontFamily:font,fontSize:13,marginBottom:6}}>
                <strong>Muestra clínica TDAH ARG:</strong> M=46 DE=9.8
              </div>
              <div style={{fontFamily:font,fontSize:12,color:C.textLight}}>
                El puntaje obtenido se encuentra {distT>=0?"a "+distT+" DE por debajo":"a "+Math.abs(distT)+" DE por encima"} de la media clínica TDAH.
              </div>
              <div style={{fontFamily:font,fontSize:12,color:C.textLight,marginTop:4}}>
                Sin diferencias por género · Percentiles para 18-50 años (mayores de 50 años puntúan levemente más alto, d=0.18).
              </div>
            </div>
          </div>
        )}

        {renderGroup("INATENCIÓN (Factor I) — ítems 1,2,3,4,7,8,9,10,11,12",iItems,scoreI,pctI,zI,C.primary)}
        {renderGroup("HIPERACTIVIDAD / IMPULSIVIDAD (Factor H) — ítems 5,6,13,14,15,16,17,18",hItems,scoreH,pctH,zH,C.dark)}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── TEST DEL RELOJ FORM ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function RelojForm({relojData,setRelojData}){
  const up=(k,v)=>setRelojData(d=>({...d,[k]:v}));
  const conditions=["TRO","TRC"];

  // Puntuaciones por condición
  const scoreOf=(cond)=>{
    const e=parseFloat(relojData[`${cond}_esfera`]);
    const n=parseFloat(relojData[`${cond}_numeros`]);
    const m=parseFloat(relojData[`${cond}_manecillas`]);
    if(isNaN(e)||isNaN(n)||isNaN(m)) return null;
    return parseFloat((e+n+m).toFixed(1));
  };
  const tro=scoreOf("TRO");
  const trc=scoreOf("TRC");
  const total=tro!==null&&trc!==null?parseFloat((tro+trc).toFixed(1)):null;

  // Clasificación
  const clsTRO=tro!==null?(tro<=6?"⚠ Positivo (≤6)":"✅ Negativo (>6)"):null;
  const clsTRC=trc!==null?(trc<=8?"⚠ Positivo (≤8)":"✅ Negativo (>8)"):null;
  const clsTot=total!==null?(total<=15?"⚠ Positivo (≤15)":"✅ Negativo (>15)"):null;
  const dangerTRO=tro!==null&&tro<=6;
  const dangerTRC=trc!==null&&trc<=8;
  const dangerTot=total!==null&&total<=15;

  const renderCondition=(cond,label)=>(
    <div style={{border:`2px solid ${C.border}`,borderRadius:12,padding:16,marginBottom:16}}>
      <div style={{background:cond==="TRO"?C.primary:C.dark,color:"white",borderRadius:8,padding:"8px 16px",marginBottom:14,fontWeight:700,fontFamily:font}}>
        {label} — Instrucción: dibujar un reloj marcando <strong>las 11 y 10</strong>
      </div>
      {["esfera","numeros","manecillas"].map(comp=>{
        const key=`${cond}_${comp}`;
        const options=RELOJ_CRITERIA[comp];
        const current=relojData[key];
        const label2=comp==="esfera"?"Esfera (0-2)":comp==="numeros"?"Números (0-4)":"Manecillas (0-4)";
        return(
          <div key={comp} style={{marginBottom:14}}>
            <div style={{fontFamily:font,fontSize:13,fontWeight:700,color:C.textMid,marginBottom:8}}>{label2}</div>
            {options.map(opt=>(
              <div key={opt.pts} onClick={()=>up(key,opt.pts)} style={{cursor:"pointer",padding:"8px 12px",marginBottom:4,borderRadius:8,border:`2px solid ${parseFloat(current)===opt.pts?C.primary:C.border}`,background:parseFloat(current)===opt.pts?`${C.primary}10`:"#fff",display:"flex",gap:10,alignItems:"flex-start"}}>
                <span style={{fontFamily:font,fontSize:15,fontWeight:800,color:parseFloat(current)===opt.pts?C.primary:C.textLight,minWidth:28}}>{opt.pts}</span>
                <span style={{fontFamily:font,fontSize:12,color:C.textDark,lineHeight:1.4}}>{opt.desc}</span>
              </div>
            ))}
          </div>
        );
      })}
      {scoreOf(cond)!==null&&(
        <div style={{background:(cond==="TRO"?dangerTRO:dangerTRC)?`${C.danger}15`:`${C.success}15`,border:`2px solid ${(cond==="TRO"?dangerTRO:dangerTRC)?C.danger:C.success}40`,borderRadius:10,padding:"10px 14px",marginTop:8}}>
          <span style={{fontFamily:font,fontWeight:700,color:(cond==="TRO"?dangerTRO:dangerTRC)?C.danger:C.success,fontSize:15}}>
            {cond} = {scoreOf(cond)}/10 &nbsp;·&nbsp; {cond==="TRO"?clsTRO:clsTRC}
          </span>
          <div style={{fontFamily:font,fontSize:11,color:C.textLight,marginTop:4}}>
            {cond==="TRO"?"Corte ≤6: Sens 92.8% · Esp 93.5% (Cacho et al. 1999)":"Corte ≤8: Sens 73.1% · Esp 90.6% (Cacho et al. 1999)"}
          </div>
        </div>
      )}
    </div>
  );

  return(
    <div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>🕐 Test del Reloj</h3>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:-28}}><ClearBtn onClear={()=>{setRelojData({})}}/></div>
        <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Cacho et al. (1999) · Escala 0-10: Esfera (2) + Números (4) + Manecillas (4)</p>
        <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 16px"}}>Instrucción: «Dibuje un reloj redondo y grande, con todos sus números, cuyas manecillas marquen las 11 y 10.»</p>

        {total!==null&&(
          <div style={{background:dangerTot?`${C.danger}10`:`${C.success}10`,border:`2px solid ${dangerTot?C.danger:C.success}40`,borderRadius:12,padding:16,marginBottom:20,display:"flex",gap:20,flexWrap:"wrap",alignItems:"center"}}>
            {[{label:"TRO",val:tro,max:10,danger:dangerTRO,cls:clsTRO},{label:"TRC",val:trc,max:10,danger:dangerTRC,cls:clsTRC},{label:"TRO+TRC",val:total,max:20,danger:dangerTot,cls:clsTot}].map(s=>(
              <div key={s.label} style={S.indexBox}>
                <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>{s.label}</div>
                <div style={{fontSize:32,fontWeight:800,fontFamily:font,color:s.danger?C.danger:C.success}}>{s.val}/{s.max}</div>
                <span style={S.badge(s.danger?C.danger:C.success)}>{s.cls}</span>
              </div>
            ))}
          </div>
        )}

        {renderCondition("TRO","A LA ORDEN")}
        {renderCondition("TRC","A LA COPIA")}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── TEST DEL HOTEL FORM ─────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function HotelForm({hotelData,setHotelData,patient}){
  const up=(k,v)=>setHotelData(d=>({...d,[k]:v}));
  const age=parseInt(patient.age)||0;
  const sex=patient.sex?.includes("Mas")?"M":"F";
  const ag=getHotelAgeGroup(age);
  const norm=ag?HOTEL_NORMS[sex]?.[ag]:null;

  const tareas=parseInt(hotelData.tareas)||0;
  const tiempoDesvio=parseFloat(hotelData.tiempoDesvio)||null;
  const botonesDesvio=parseFloat(hotelData.botonesDesvio)||null;

  const zTareas=norm&&hotelData.tareas!==""?zScore(tareas,norm.tareasM,norm.tareasSD):null;
  const zTiempo=norm&&hotelData.tiempoDesvio!==""?parseFloat(((tiempoDesvio-norm.tiempoM)/norm.tiempoSD).toFixed(2)):null;
  const zBotones=norm&&hotelData.botonesDesvio!==""?parseFloat(((botonesDesvio-norm.botonesM)/norm.botonesSD).toFixed(2)):null;

  // Para desvíos: mayor desvío = peor rendimiento → invertido
  const clsTareas=classifyZ(zTareas,false);
  const clsTiempo=classifyZ(zTiempo?-zTiempo:null,false); // mayor desvío = peor
  const clsBotones=classifyZ(zBotones?-zBotones:null,false);

  return(
    <div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>🏨 Test del Hotel</h3>
        <div style={{display:"flex",justifyContent:"flex-end",marginTop:-28}}><ClearBtn onClear={()=>{setHotelData({})}}/></div>
        <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Manly et al. (2002) · Adaptación ARG: Torralva et al. (2009) · Normas ARG: Pinasco et al. (2022)</p>
        <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 16px"}}>Evalúa multitasking y memoria prospectiva. 5 tareas en 15 minutos + apertura/cierre de garaje. N=160, 19-60 años, ≥12 años educación, Buenos Aires.</p>

        {!ag&&age>0&&<div style={{background:`${C.warning}15`,border:`1px solid ${C.warning}`,borderRadius:8,padding:10,marginBottom:16,fontFamily:font,fontSize:13,color:C.warning}}>⚠ Normas disponibles para 19-59 años. Edad actual: {age} años.</div>}
        {age===0&&<div style={{background:`${C.warning}15`,border:`1px solid ${C.warning}`,borderRadius:8,padding:10,marginBottom:16,fontFamily:font,fontSize:13,color:C.warning}}>⚠ Ingresá la edad del paciente para ver los baremos correspondientes.</div>}

        {norm&&(
          <div style={{background:`${C.primary}08`,borderRadius:10,padding:12,marginBottom:16,fontFamily:font,fontSize:12,color:C.textMid}}>
            Grupo: {sex==="M"?"Varones":"Mujeres"} · {ag} años · 
            Tareas: M={norm.tareasM} DE={norm.tareasSD} · 
            Desvío tiempo: M={norm.tiempoM}s DE={norm.tiempoSD}s · 
            Desvío botones: M={norm.botonesM}s DE={norm.botonesSD}s
          </div>
        )}

        <div style={S.grid3}>
          {[
            {key:"tareas",label:"Cantidad de tareas realizadas",placeholder:"0-5",max:5,desc:"Número de tareas intentadas (de 5 disponibles). Asignación óptima: ≥3 tareas."},
            {key:"tiempoDesvio",label:"Desvío total del tiempo (seg)",placeholder:"Ej: 350",desc:"Suma de desviaciones de tiempo por tarea vs asignación óptima de 180 seg. Mayor desvío = peor rendimiento."},
            {key:"botonesDesvio",label:"Desvío de botones del garaje (seg)",placeholder:"Ej: 120",desc:"Suma de desviaciones de tiempo en apertura y cierre del garaje. Mayor desvío = peor rendimiento."},
          ].map(field=>{
            const val=hotelData[field.key];
            const z=field.key==="tareas"?zTareas:field.key==="tiempoDesvio"?zTiempo:zBotones;
            const cls=field.key==="tareas"?clsTareas:field.key==="tiempoDesvio"?clsTiempo:clsBotones;
            return(
              <div key={field.key} style={{border:`2px solid ${C.border}`,borderRadius:12,padding:14}}>
                <div style={{fontFamily:font,fontSize:13,fontWeight:700,color:C.textMid,marginBottom:4}}>{field.label}</div>
                <div style={{fontFamily:font,fontSize:11,color:C.textLight,marginBottom:8,lineHeight:1.4}}>{field.desc}</div>
                <input type="number" min={0} max={field.max||9999} style={S.input} value={val||""} onChange={e=>up(field.key,e.target.value)} placeholder={field.placeholder}/>
                {z!==null&&norm&&(
                  <div style={{marginTop:8,background:`${cls?cls.color:"transparent"}15`,borderRadius:6,padding:"6px 10px"}}>
                    <span style={{fontFamily:font,fontWeight:700,color:cls?cls.color:C.textLight}}>Z={z>0?"+":""}{z}</span>
                    <span style={{...S.badge(cls?cls.color:C.textLight),marginLeft:8}}>{cls?cls.label:"—"}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{marginTop:16,background:"#f8f8f8",borderRadius:10,padding:14}}>
          <div style={{fontFamily:font,fontSize:12,fontWeight:700,color:C.textMid,marginBottom:8}}>Nota de interpretación</div>
          <div style={{fontFamily:font,fontSize:12,color:C.textLight,lineHeight:1.6}}>
            • Sin efecto de edad (19-59) ni educación (≥12 años) en ninguna variable.<br/>
            • Diferencias pequeñas por sexo en desvío tiempo (d=0.2) y botones (d=0.15), por eso los baremos están separados.<br/>
            • Para desvíos: valores <em>más bajos</em> = mejor rendimiento (menor alejamiento del tiempo óptimo).<br/>
            • Para tareas: valores <em>más altos</em> = mejor rendimiento.
          </div>
        </div>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════════════════════
// ─── TestCatalogView: vista de tarjetas del catálogo ─────────
// ════════════════════════════════════════════════════════════
const DOMAIN_COLORS = {
  "Atención":"#2e7d9e","Funciones ejecutivas":"#6b3fa0","Memoria":"#2e7d5e",
  "Lenguaje":"#7d5e2e","Habilidades visoespaciales":"#7d2e5e","Inteligencia":"#2e4e7d",
  "Screening":"#3d7d2e","Emocionales":"#9e2e2e","TDAH":"#7d6b2e","TEA":"#4a7d2e",
};

function TestCatalogView({items, domainFilter, adminTests, font, C, S, onSelectTest}){
  const [search, setSearch] = useState("");
  const [activeDomain, setActiveDomain] = useState(domainFilter||"");

  const filtered = items.filter(t=>{
    const domains = Array.isArray(t.domains)?t.domains:[t.domain||""];
    const domMatch = !activeDomain || domains.some(d=>d===activeDomain);
    const srchMatch = !search ||
      t.label.toLowerCase().includes(search.toLowerCase()) ||
      (t.desc||"").toLowerCase().includes(search.toLowerCase()) ||
      domains.some(d=>d.toLowerCase().includes(search.toLowerCase()));
    return domMatch && srchMatch;
  });

  // Dominios únicos presentes en este grupo
  const groupDomains = [...new Set(items.flatMap(t=>Array.isArray(t.domains)?t.domains:[t.domain||""]))];

  return (
    <div style={{padding:"0 0 40px"}}>
      {/* Barra de búsqueda y filtros */}
      <div style={{background:"#fff",borderBottom:`1px solid ${C.border}`,padding:"14px 24px",display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <input
          value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Buscar prueba..."
          style={{padding:"7px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:13,fontFamily:font,flex:1,minWidth:180,outline:"none"}}
        />
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <button
            onClick={()=>setActiveDomain("")}
            style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${activeDomain===""?C.primary:C.border}`,background:activeDomain===""?C.primary:"#fff",color:activeDomain===""?"#fff":C.textMid,fontSize:11,fontFamily:font,cursor:"pointer",fontWeight:600}}
          >Todos</button>
          {groupDomains.map(d=>(
            <button key={d}
              onClick={()=>setActiveDomain(activeDomain===d?"":d)}
              style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${activeDomain===d?(DOMAIN_COLORS[d]||C.primary):C.border}`,background:activeDomain===d?(DOMAIN_COLORS[d]||C.primary):"#fff",color:activeDomain===d?"#fff":C.textMid,fontSize:11,fontFamily:font,cursor:"pointer",fontWeight:600}}
            >{d}</button>
          ))}
        </div>
      </div>

      {/* Grilla de tarjetas */}
      <div style={{padding:"20px 24px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
        {filtered.length===0&&(
          <div style={{gridColumn:"1/-1",textAlign:"center",color:C.textLight,fontFamily:font,padding:40,fontSize:14}}>
            No se encontraron pruebas con ese filtro.
          </div>
        )}
        {filtered.map(t=>{
          const domains = Array.isArray(t.domains)?t.domains:[t.domain||""];
          const isAdmin = !!adminTests[t.id];
          return (
            <div key={t.id}
              onClick={()=>onSelectTest(t)}
              style={{background:"#fff",borderRadius:12,padding:"18px 20px",cursor:"pointer",
                border:`1.5px solid ${isAdmin?C.primary:C.border}`,
                boxShadow:isAdmin?"0 0 0 3px rgba(126,34,46,0.08)":"0 1px 4px rgba(0,0,0,0.05)",
                transition:"box-shadow 0.15s,border-color 0.15s",
                position:"relative"}}
            >
              {/* Badge "administrada" */}
              {isAdmin&&(
                <div style={{position:"absolute",top:12,right:14,fontSize:10,background:C.primary,color:"#fff",borderRadius:10,padding:"2px 8px",fontFamily:font,fontWeight:700}}>
                  ✓ Administrada
                </div>
              )}
              {/* Nombre */}
              <div style={{fontSize:15,fontWeight:700,color:C.textDark,fontFamily:font,marginBottom:6,paddingRight:isAdmin?80:0,lineHeight:1.3}}>
                {t.label.split(" — ")[0]}
              </div>
              {/* Descripción */}
              {t.desc&&(
                <div style={{fontSize:12,color:C.textMid,fontFamily:font,lineHeight:1.5,marginBottom:10}}>
                  {t.desc}
                </div>
              )}
              {/* Dominios */}
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                {domains.map(d=>(
                  <span key={d} style={{fontSize:10,padding:"2px 8px",borderRadius:10,background:`${DOMAIN_COLORS[d]||"#666"}18`,color:DOMAIN_COLORS[d]||"#666",fontFamily:font,fontWeight:700}}>
                    {d}
                  </span>
                ))}
              </div>
              {/* Baremos */}
              {t.baremos&&(
                <div style={{fontSize:10,color:C.textLight,fontFamily:font,borderTop:`1px solid ${C.border}`,paddingTop:8,marginTop:4}}>
                  📊 {t.baremos}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// ─── SidebarGroup: bloque colapsable del sidebar ─────────────
// ════════════════════════════════════════════════════════════
function SidebarGroup({label, items, tab, section, adminTests, font, C, S, onClickGroup, onClickItem}){
  const [open, setOpen] = useState(true);
  const activeCount = items.filter(t=>adminTests[t.id]).length;
  return (
    <div>
      {/* Header del bloque */}
      <button
        onClick={()=>setOpen(o=>!o)}
        style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
          padding:"10px 16px 6px",border:"none",background:"transparent",cursor:"pointer",
          borderTop:"1px solid rgba(255,255,255,0.06)"}}
      >
        <span style={{fontSize:9,fontWeight:700,color:"rgba(200,216,228,0.55)",letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:font,textAlign:"left",flex:1}}>{label}</span>
        <span style={{display:"flex",alignItems:"center",gap:6}}>
          {activeCount>0&&<span style={{fontSize:9,background:"rgba(237,105,116,0.35)",color:"#fff",borderRadius:10,padding:"1px 6px",fontFamily:font}}>{activeCount}</span>}
          <span style={{color:"rgba(240,192,200,0.5)",fontSize:10}}>{open?"▾":"▸"}</span>
        </span>
      </button>
      {open&&(
        <div>
          {/* Acceso al catálogo de este grupo */}
          <button
            onClick={onClickGroup}
            style={{width:"100%",textAlign:"left",padding:"5px 16px 5px 24px",border:"none",
              background:"rgba(255,255,255,0.04)",cursor:"pointer",fontFamily:font,
              fontSize:11,color:"rgba(237,105,116,0.9)",display:"flex",alignItems:"center",gap:6}}
          >
            <span style={{fontSize:10}}>☰</span>
            <span>Ver todas + filtros</span>
          </button>
          {/* Lista de pruebas */}
          {items.map(t=>(
            <button key={t.id}
              style={{...S.sidebarItem(tab===t.id),paddingLeft:26,fontFamily:font,fontSize:12,fontStyle:"normal"}}
              onClick={()=>onClickItem(t)}
            >
              <span style={{width:7,height:7,borderRadius:"50%",flexShrink:0,
                background:adminTests[t.id]?"#ED6974":"rgba(240,192,200,0.18)"}}/>
              <span style={{lineHeight:1.3}}>{t.label.split(" — ")[0]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function App(){
  const [tab,setTab]=useState("patient");
  const [section,setSection]=useState("pruebas"); // "pruebas"|"cuestionarios"
  const [domainFilter,setDomainFilter]=useState("");
  const [searchFilter,setSearchFilter]=useState("");
  const [adminTests,setAdminTests]=useState({}); // {testId: true/false}
  const [savedPatients,setSavedPatients]=useState([]);
  const [saveStatus,setSaveStatus]=useState("");
  const [patient,setPatient]=useState({name:"",age:"",sex:"",education:"",educYears:"",date:new Date().toISOString().split("T")[0],reason:""});
  const [briefScores,setBriefScores]=useState({});
  const [mocaScores,setMocaScores]=useState({});
  const [tmtData,setTmtData]=useState({timeA:"",timeB:"",errorsA:"",errorsB:""});
  const [fvData,setFvData]=useState({semantic:"",phonologic:""});
  const [stroopData,setStroopData]=useState({P:"",C:"",PC:""});
  const [ravltData,setRavltData]=useState({});
  const [tavecData,setTavecData]=useState({});
  const [wms3Data,setWms3Data]=useState({});
  const [mbiScores,setMbiScores]=useState({});
  const [waisData,setWaisData]=useState({});
  const [wcstData,setWcstData]=useState({});
  const [ifsData,setIfsData]=useState({});
  const [waisAttenData,setWaisAttenData]=useState({});
  const [badsData,setBadsData]=useState({});
  const [reyData,setReyData]=useState({copia:"",memoria:"",tipo:""});
  const [snapData,setSnapData]=useState({});
  const [papdiData,setPapdiData]=useState({libre:"",guiada:""});
  const [bntData,setBntData]=useState({mode:"60",score:""});
  const [scl90Data,setScl90Data]=useState({});
  const [srsData,setSrsData]=useState({_informant:"parent",_sex:"M"});
  const [wisc5Data,setWisc5Data]=useState({});
  const [carasData,setCarasData]=useState({grade:"",A:"",E:""});
  const [d2Data,setD2Data]=useState({});
  const [neuropsiData,setNeuropsiData]=useState({});
  const [wursData,setWursData]=useState({});
  const [wursMode,setWursMode]=useState("25");
  const [asrsData,setAsrsData]=useState({});
  const [relojData,setRelojData]=useState({});
  const [hotelData,setHotelData]=useState({});

  const upPatient=(k,v)=>setPatient(p=>({...p,[k]:v}));
  const age=parseInt(patient.age)||0;

  // ─── Compute results ───
  const results={};

  // BRIEF-A
  const briefAge=getAgeGroup(age,["18-29","30-39","40-49","50-59","60-65","66-80"])||"50-59";
  const scales={};
  let briOk=true;
  BRIEF_SCALES.forEach(sc=>{const v=briefScores[sc.key];if(!v){briOk=false;return;}const t=lookupNearest(BRIEF_NORMS[sc.key]?.[briefAge],parseInt(v));scales[sc.key]={raw:parseInt(v),t,label:classifyT(t).label};});
  if(briOk){
    const briSum=["inhibit","shift","emotionalControl","selfMonitor"].reduce((s,k)=>s+(briefScores[k]?parseInt(briefScores[k]):0),0);
    const miSum=["initiate","workingMemory","planOrganize","taskMonitor","orgMaterials"].reduce((s,k)=>s+(briefScores[k]?parseInt(briefScores[k]):0),0);
    const gecSum=briSum+miSum;
    const briT=lookupNearest(BRIEF_INDEX_NORMS.BRI[briefAge],briSum);
    const miT=lookupNearest(BRIEF_INDEX_NORMS.MI[briefAge],miSum);
    const gecT=lookupNearest(BRIEF_INDEX_NORMS.GEC[briefAge],gecSum);
    results.briefa={scales,BRI:{raw:briSum,t:briT,...classifyT(briT)},MI:{raw:miSum,t:miT,...classifyT(miT)},GEC:{raw:gecSum,t:gecT,...classifyT(gecT)}};
  }

  // MoCA
  const mocaTotal=MOCA_DOMAINS.reduce((s,d)=>s+(parseInt(mocaScores[d.key])||0),0);
  if(mocaTotal>0){
    const educYears=parseInt(patient.educYears)||12;
    const adjusted=educYears<12?Math.min(mocaTotal+1,30):mocaTotal;
    const label=adjusted>=26?"Normal":adjusted>=21?"DCL":"Posible demencia";
    const color=adjusted>=26?C.success:adjusted>=21?C.warning:C.danger;
    results.moca={total:mocaTotal,adjusted,label,color};
  }

  // TMT
  const tmtAg=getTMTAgeGroup(age);
  const tmtNorm=tmtAg?TMT_AGE_NORMS[tmtAg]:null;
  if(tmtNorm&&(tmtData.timeA||tmtData.timeB)){
    const tA=parseFloat(tmtData.timeA),tB=parseFloat(tmtData.timeB);
    const zA=!isNaN(tA)&&tA>0?parseFloat(((tmtNorm.A.mean-tA)/tmtNorm.A.sd).toFixed(2)):null;
    const zB=!isNaN(tB)&&tB>0?parseFloat(((tmtNorm.B.mean-tB)/tmtNorm.B.sd).toFixed(2)):null;
    let zDiff=null;
    if(!isNaN(tA)&&!isNaN(tB)&&tA>0&&tB>0){const diff=tB-tA;const dm=tmtNorm.B.mean-tmtNorm.A.mean;const ds=Math.sqrt(tmtNorm.A.sd**2+tmtNorm.B.sd**2);zDiff=parseFloat(((dm-diff)/ds).toFixed(2));}
    results.tmt={ageGroup:tmtAg,timeA:isNaN(tA)?null:tA,timeB:isNaN(tB)?null:tB,errorsA:parseInt(tmtData.errorsA)||0,errorsB:parseInt(tmtData.errorsB)||0,zA,zB,zBminusA:zDiff,classA:classifyZ(zA,true),classB:classifyZ(zB,true),classDiff:classifyZ(zDiff,true)};
  }

  // FV
  const fvAg=getFVAgeGroup(age);const fvEdL=getEdLevelFV(patient.education);const fvNorm=fvAg&&fvEdL?FV_NORMS_ALLEGRI[fvAg]?.[fvEdL]:null;
  if(fvNorm&&(fvData.semantic||fvData.phonologic)){
    const sem=fvData.semantic!==""?parseFloat(fvData.semantic):null;
    const fon=fvData.phonologic!==""?parseFloat(fvData.phonologic):null;
    const zSem=sem!==null?parseFloat(((sem-fvNorm.sem.mean)/fvNorm.sem.sd).toFixed(2)):null;
    const zFon=fon!==null?parseFloat(((fon-fvNorm.fon.mean)/fvNorm.fon.sd).toFixed(2)):null;
    const sexKey=patient.sex?.includes("Mas")?"M":"F";
    const fn=FV_NORMS_FERNANDEZ[sexKey]?.[fvEdL];
    const fr=sem!==null&&fn?{z:parseFloat(((sem-fn.mean)/fn.sd).toFixed(2)),mean:fn.mean,sd:fn.sd,sexLabel:sexKey==="M"?"Varones":"Mujeres"}:null;
    results.fv={ageGroup:fvAg,edLevel:fvEdL,semantic:sem,phonologic:fon,zSem,zFon,clsSem:classifyZ(zSem),clsFon:classifyZ(zFon),normSem:fvNorm.sem,normFon:fvNorm.fon,fernandezRef:fr};
  }

  // Stroop
  if(stroopData.P||stroopData.C||stroopData.PC){
    results.stroop=computeStroop(stroopData,age,patient.education);
  }

  // RAVLT
  const ravltAdultGroup=getRavltAdultGroup(age);
  const ravltIsAdult=age>=16&&!!ravltAdultGroup;
  const ravltIsChild=age>=5&&age<=14;
  if(ravltIsAdult||ravltIsChild){
    results.ravlt={
      age,isAdult:ravltIsAdult,isChild:ravltIsChild,
      adultGroup:ravltAdultGroup,
      adultNorm:ravltAdultGroup?RAVLT_ADULT_NORMS[ravltAdultGroup]:null,
      childNorm:ravltIsChild?RAVLT_CHILD_NORMS[age]:null,
      scores:ravltData,
    };
  }

  // TAVEC
  const tavecAg=getTavecAgeGroup(age);
  const tavecNorm=tavecAg?TAVEC_NORMS[tavecAg]:null;
  if(Object.keys(tavecData).length>0){
    results.tavec={ag:tavecAg,norm:tavecNorm,scores:tavecData};
  }

  // WMS-3
  if(Object.keys(wms3Data).some(k=>wms3Data[k])){
    results.wms3=wms3Data;
  }

  // WAIS-IV
  if(WAIS_INDEXES.some(idx=>waisData[idx.key])||WAIS_SUBTESTS.some(st=>waisData[st.key])){
    results.wais={...waisData};
  }

  // WCST
  const wcstAg=getWCSTAgeGroup(age);
  if(Object.keys(wcstData).some(k=>wcstData[k]!==undefined&&wcstData[k]!=="")){
    results.wcst={ageGroup:wcstAg,scores:wcstData};
  }

  // IFS
  const ifsDone=IFS_SUBTESTS.every(t=>ifsData[t.key]!==undefined&&ifsData[t.key]!=="");
  if(ifsDone){
    const ifsTotal=IFS_SUBTESTS.reduce((s,t)=>s+(parseFloat(ifsData[t.key])||0),0);
    const ifsWM=(parseFloat(ifsData.digitsBack)||0)+(parseFloat(ifsData.spatialWT)||0);
    results.ifs={total:ifsTotal,wm:ifsWM,below:ifsTotal<IFS_CUTOFF,scores:ifsData};
  }

  // MBI
  const sumAE=MBI_ITEMS.filter(i=>i.sub==="AE").reduce((s,i)=>s+(mbiScores[i.num]||0),0);
  const sumD=MBI_ITEMS.filter(i=>i.sub==="D").reduce((s,i)=>s+(mbiScores[i.num]||0),0);
  const sumRP=MBI_ITEMS.filter(i=>i.sub==="RP").reduce((s,i)=>s+(mbiScores[i.num]||0),0);
  const mbiDone=MBI_ITEMS.every(i=>mbiScores[i.num]!=null);
  if(mbiDone){
    const clsAE=classifyMBI("AE",sumAE),clsD=classifyMBI("D",sumD),clsRP=classifyMBI("RP",sumRP);
    results.mbi={sumAE,sumD,sumRP,clsAE,clsD,clsRP,burnout:clsAE.burnout&&clsD.burnout&&clsRP.burnout};
  }


  // BADS
  const badsTotal=BADS_SUBTESTS.reduce((s,t)=>{const v=parseFloat(badsData[t.key]);return s+(isNaN(v)?0:v);},0);
  if(BADS_SUBTESTS.every(t=>badsData[t.key]!==undefined&&badsData[t.key]!=="")){
    const bz=parseFloat(((badsTotal-BADS_NORMS.m)/BADS_NORMS.sd).toFixed(2));
    results.bads={total:badsTotal,z:bz,label:classifyZ(bz).label};
  }

  // Figura Compleja de Rey
  const reyCopia=reyData.copia!==""&&reyData.copia!==undefined?parseFloat(reyData.copia):null;
  const reyMemoria=reyData.memoria!==""&&reyData.memoria!==undefined?parseFloat(reyData.memoria):null;
  if(reyCopia!==null||reyMemoria!==null){
    results.rey={
      copia:reyCopia,memoria:reyMemoria,tipo:reyData.tipo,
      copiaPC:reyCopia!==null?reyScoreToPc(reyCopia,REY_COPIA_PC):null,
      memoriaPC:reyMemoria!==null?reyScoreToPc(reyMemoria,REY_MEMORIA_PC):null,
      retencion:reyCopia&&reyMemoria&&reyCopia>0?parseFloat((reyMemoria/reyCopia*100).toFixed(1)):null,
    };
  }

  // SNAP-IV
  const snapDA_items=SNAP_ITEMS.filter(i=>i.sub==="DA");
  const snapHI_items=SNAP_ITEMS.filter(i=>i.sub==="HI");
  const snapODD_items=SNAP_ITEMS.filter(i=>i.sub==="ODD");
  if(snapDA_items.every(i=>snapData[i.num]!==undefined)||snapHI_items.every(i=>snapData[i.num]!==undefined)){
    const sDA=snapDA_items.reduce((s,i)=>s+(parseInt(snapData[i.num])||0),0);
    const sHI=snapHI_items.reduce((s,i)=>s+(parseInt(snapData[i.num])||0),0);
    const sODD=snapODD_items.reduce((s,i)=>s+(parseInt(snapData[i.num])||0),0);
    const mDA=parseFloat((sDA/snapDA_items.length).toFixed(2));
    const mHI=parseFloat((sHI/snapHI_items.length).toFixed(2));
    const dA=mDA>=SNAP_CUTOFFS.DA.indexCut;const hI=mHI>=SNAP_CUTOFFS.HI.indexCut;
    results.snap={sumDA:sDA,sumHI:sHI,sumODD:sODD,meanDA:mDA,meanHI:mHI,daPos:dA,hiPos:hI,subtype:dA&&hI?"Combinado":dA?"Inatento":hI?"Hiperactivo-Impulsivo":"Sin perfil TDAH"};
  }

  // PAPDI
  if(papdiData.libre!==""&&papdiData.libre!==undefined){
    const pAge=parseInt(age)||0;
    const pg=getPAPDIGroup(pAge);const ped=getPAPDIEd(patient.educYears||"0");
    const pnorm=pg?PAPDI_NORMS[pg]?.[ped]:null;
    const pl=parseFloat(papdiData.libre);
    const pz=pnorm?parseFloat(((pl-pnorm.m)/pnorm.sd).toFixed(2)):null;
    results.papdi={score:pl,z:pz,label:pz!==null?(pz<=-1.5?"Anomia presente":classifyZ(pz).label):"—"};
  }

  // BNT
  if(bntData.score!==""&&bntData.score!==undefined){
    const bs=parseFloat(bntData.score);const bmode=bntData.mode||"60";
    const bag=getBNT60Group(parseInt(age)||0);const bed=getBNT60Ed(patient.educYears||"0");
    const bnorm=bag&&bmode==="60"?BNT60_NORMS[bag]?.[bed]:null;
    const bz=bnorm?parseFloat(((bs-bnorm.m)/bnorm.sd).toFixed(2)):null;
    const b12cut=bmode==="12"&&bs<9;
    results.bnt={score:bs,mode:bmode,z:bz,label:bmode==="12"?(b12cut?"Positivo (<9)":"Normal (≥9)"):bz!==null?classifyZ(bz).label:"—"};
  }

  // SCL-90-R
  const sex90=patient.sex?.includes("Mas")?"M":"F";
  const scl90AllDone=SCL90_ITEMS.every(i=>scl90Data[i.n]!==undefined&&scl90Data[i.n]!=="");
  if(scl90AllDone){
    const dimScores90={};
    Object.keys(SCL90_DIMS).forEach(dk=>{
      const vals=SCL90_DIMS[dk].items.map(n=>parseInt(scl90Data[n]));
      const raw=parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(3));
      const t=sclRawToT(raw,dk,sex90);
      dimScores90[dk]={raw,t,cls:classifySCL(t)};
    });
    const totalSum90=SCL90_ITEMS.reduce((s,i)=>s+(parseInt(scl90Data[i.n])||0),0);
    const PST90=SCL90_ITEMS.filter(i=>parseInt(scl90Data[i.n])>0).length;
    const IGS90=parseFloat((totalSum90/90).toFixed(3));
    const PSDI90=PST90>0?parseFloat((totalSum90/PST90).toFixed(3)):null;
    const igsT90=sclRawToT(IGS90,"IGS",sex90);
    results.scl90={dims:dimScores90,IGS:IGS90,PST:PST90,PSDI:PSDI90,igsT:igsT90,igsCls:classifySCL(igsT90)};
  }

  // SRS
  const srsRaw=srsRawScore(srsData);
  if(srsRaw!==null){
    const srsT=srsToT(srsRaw,srsData._informant||"parent",srsData._sex||"M");
    results.srs={raw:srsRaw,t:srsT,cls:classifySRS(srsT),informant:srsData._informant,sex:srsData._sex};
  }

  // WISC-V
  const wisc5get=(k)=>wisc5Data[k]!==""&&wisc5Data[k]!==undefined?parseFloat(wisc5Data[k]):null;
  const wisc5hasData=WISC5_INDEXES.some(i=>wisc5get(i.key)!==null)||WISC5_SUBTESTS.some(s=>wisc5get(s.key)!==null);
  if(wisc5hasData){
    const indexes={};
    WISC5_INDEXES.forEach(i=>{
      const val=wisc5get(i.key);
      if(val!==null){
        indexes[i.key]={val,cls:classifyWISC5(val),pct:wisc5Pct(val),ci:wisc5CI(val,WISC5_SEM[i.key])};
      }
    });
    const subtests={};
    WISC5_SUBTESTS.forEach(s=>{const v=wisc5get(s.key);if(v!==null)subtests[s.key]=v;});
    results.wisc5={indexes,subtests};
  }

  // WAIS Atención (RD, CLA, SLN) — desde brutos
  if(waisAttenData.rdBruto||waisAttenData.claBruto||waisAttenData.slnBruto){
    const ag=waisAttenData.waisGroup||"";
    const rdPEc=ag?waisBrutoToPE(waisAttenData.rdBruto,"rd",ag):null;
    const claPEc=ag?waisBrutoToPE(waisAttenData.claBruto,"cla",ag):null;
    const slnPEc=ag?waisBrutoToPE(waisAttenData.slnBruto,"sln",ag||"20-24"):null;
    const zpf=(pe)=>pe!==null?parseFloat(((pe-10)/3).toFixed(2)):null;
    results.waisAtten={rdPE:rdPEc,claPE:claPEc,slnPE:slnPEc,
      zRD:zpf(rdPEc),zCLA:zpf(claPEc),zSLN:zpf(slnPEc)};
  }

  // CARAS-R
  if(carasData.grade&&carasData.A!==""&&carasData.E!==""){
    const norm=CARAS_NORMS[carasData.grade];
    const A=parseFloat(carasData.A),E=parseFloat(carasData.E);
    const AE=A-E;
    const ICI=(A+E)>0?parseFloat(((A-E)/(A+E)*100).toFixed(1)):null;
    const zAE=parseFloat(((AE-norm.AE.m)/norm.AE.sd).toFixed(2));
    const zA=parseFloat(((A-norm.A.m)/norm.A.sd).toFixed(2));
    const eneatipo=getEneatipo(zAE);
    results.caras={grade:carasData.grade,norm,A,E,AE,ICI,zAE,zA,eneatipo,cls:classifyZ(zAE)};
  }

  // d2
  const d2g=(k)=>d2Data[k]!==undefined&&d2Data[k]!==""?parseFloat(d2Data[k]):null;
  const d2TR=d2g("TR"),d2O=d2g("O"),d2C=d2g("C"),d2TRp=d2g("TRp"),d2TRm=d2g("TRm");
  if(d2TR!==null||d2O!==null){
    const d2TA=(d2TR!==null&&d2O!==null&&d2C!==null)?Math.max(d2TR-d2O-d2C,0):null;
    const d2CON=(d2TA!==null&&d2C!==null)?d2TA-d2C:null;
    const d2VAR=(d2TRp!==null&&d2TRm!==null)?d2TRp-d2TRm:null;
    const d2Epct=(d2TR!==null&&d2TR>0&&d2O!==null&&d2C!==null)?parseFloat(((d2O+d2C)/d2TR*100).toFixed(1)):null;
    const zTA=d2TA!==null?parseFloat(((d2TA-D2_NORMS.totCorr.m)/D2_NORMS.totCorr.sd).toFixed(2)):null;
    const zCON=d2CON!==null?parseFloat(((d2CON-D2_NORMS.conc.m)/D2_NORMS.conc.sd).toFixed(2)):null;
    const zO=d2O!==null?parseFloat((-(d2O-D2_NORMS.oErr.m)/D2_NORMS.oErr.sd).toFixed(2)):null;
    results.d2={TR:d2TR,TA:d2TA,O:d2O,C:d2C,VAR:d2VAR,CON:d2CON,Epct:d2Epct,zTA,zCON,zO};
  }

  // NEUROPSI
  const neuroDoms={};
  let neuroAny=false;
  ["Orientación","Atención","Codificación","Lenguaje","FE","Motoras","Evocación"].forEach(dom=>{
    const subs=NEUROPSI_SUBTESTS.filter(s=>s.domain===dom);
    const tot=subs.reduce((a,s)=>a+(parseInt(neuropsiData[s.key])||0),0);
    const max=subs.reduce((a,s)=>a+s.max,0);
    if(subs.some(s=>neuropsiData[s.key]!==undefined&&neuropsiData[s.key]!=="")) neuroAny=true;
    neuroDoms[dom]={tot,max};
  });
  if(neuroAny){
    const neuroTotal=Object.values(neuroDoms).reduce((a,v)=>a+v.tot,0);
    results.neuropsi={domains:neuroDoms,total:neuroTotal};
  }

  // WURS
  const wurs25Done=WURS25_ITEMS.every(item=>wursData[item.num]!==undefined);
  if(wurs25Done){
    const score25=WURS25_ITEMS.reduce((s,item)=>s+(parseInt(wursData[item.num])||0),0);
    const z25=parseFloat(((score25-WURS_NORM_ARG.mean)/WURS_NORM_ARG.sd).toFixed(2));
    const pct25=wursPercentile(score25);
    results.wurs={score25,z25,pct25,cutScandar:score25>=36.5,cutWard:score25>=46,mode:wursMode};
  }

  // ASRS
  const asrsDone=ASRS_ITEMS.every(i=>asrsData[i.num]!==undefined);
  if(asrsDone){
    const iItems=ASRS_ITEMS.filter(i=>i.factor==="I");
    const hItems=ASRS_ITEMS.filter(i=>i.factor==="H");
    const scoreI=iItems.reduce((s,i)=>s+(parseInt(asrsData[i.num])||0),0);
    const scoreH=hItems.reduce((s,i)=>s+(parseInt(asrsData[i.num])||0),0);
    const scoreT=scoreI+scoreH;
    results.asrs={scoreT,scoreI,scoreH,
      pctT:asrsPercentile(scoreT,ASRS_PERCENTILES_T),
      pctI:asrsPercentile(scoreI,ASRS_PERCENTILES_I),
      pctH:asrsPercentile(scoreH,ASRS_PERCENTILES_H),
      zT:parseFloat(((scoreT-30.22)/10.70).toFixed(2)),
      zI:parseFloat(((scoreI-15.22)/5.61).toFixed(2)),
      zH:parseFloat(((scoreH-14.96)/6.25).toFixed(2)),
    };
  }

  // Reloj
  const relojTRO=(()=>{const e=parseFloat(relojData.TRO_esfera),n=parseFloat(relojData.TRO_numeros),m=parseFloat(relojData.TRO_manecillas);if(isNaN(e)||isNaN(n)||isNaN(m))return null;return parseFloat((e+n+m).toFixed(1));})();
  const relojTRC=(()=>{const e=parseFloat(relojData.TRC_esfera),n=parseFloat(relojData.TRC_numeros),m=parseFloat(relojData.TRC_manecillas);if(isNaN(e)||isNaN(n)||isNaN(m))return null;return parseFloat((e+n+m).toFixed(1));})();
  if(relojTRO!==null||relojTRC!==null){
    results.reloj={tro:relojTRO,trc:relojTRC,total:relojTRO!==null&&relojTRC!==null?parseFloat((relojTRO+relojTRC).toFixed(1)):null};
  }

  // Hotel
  if(hotelData.tareas||hotelData.tiempoDesvio||hotelData.botonesDesvio){
    const hotelAg=getHotelAgeGroup(age);
    const hotelSex=patient.sex?.includes("Mas")?"M":"F";
    const hotelNorm=hotelAg?HOTEL_NORMS[hotelSex]?.[hotelAg]:null;
    results.hotel={data:hotelData,norm:hotelNorm,ag:hotelAg,sex:hotelSex};
  }

  // ─── helpers de guardado ────────────────────────────────────────────────────
  function getAllState(){return{patient,briefScores,mocaScores,tmtData,fvData,stroopData,ravltData,tavecData,wms3Data,mbiScores,waisData,wcstData,ifsData,waisAttenData,badsData,reyData,snapData,papdiData,bntData,scl90Data,srsData,wisc5Data,carasData,d2Data,neuropsiData,wursData,wursMode,asrsData,relojData,hotelData,adminTests};}
  function limpiarResultados(){
    if(!window.confirm("¿Limpiar todos los resultados de las pruebas? Los datos del paciente se conservan.")) return;
    setBriefScores({});setMocaScores({});setTmtData({});setFvData({});setStroopData({});
    setRavltData({});setTavecData({});setWms3Data({});setMbiScores({});setWaisData({});
    setWcstData({});setIfsData({});setWaisAttenData({});setBadsData({});
    setReyData({copia:"",memoria:"",tipo:""});setSnapData({});
    setPapdiData({libre:"",guiada:""});setBntData({mode:"60",score:""});
    setScl90Data({});setSrsData({_informant:"parent",_sex:"M"});setWisc5Data({});
    setCarasData({grade:"",A:"",E:""});setD2Data({});setNeuropsiData({});
    setWursData({});setWursMode("25");setAsrsData({});setRelojData({});setHotelData({});
    setAdminTests({});
  }

  // ─── Cuestionarios virtuales ──────────────────────────────────────────────
  const [sessionCode,setSessionCode]=useState("");
  const [sessionLink,setSessionLink]=useState("");
  const [sessionStatus,setSessionStatus]=useState("");
  const [selectedQForSend,setSelectedQForSend]=useState({});
  const [sessionType,setSessionType]=useState("paciente"); // "paciente" | "familiar"

  function generarLinkVirtual(){
    if(!patient.name){setSessionStatus("⚠ Ingresá el nombre del paciente primero.");return;}
    const qList=Object.keys(selectedQForSend).filter(k=>selectedQForSend[k]);
    if(!qList.length){setSessionStatus("⚠ Seleccioná al menos un cuestionario.");return;}
    const code=[...Array(10)].map(()=>Math.random().toString(36)[2]).join("").toUpperCase();
    setSessionCode(code);
    const sessionData={
      code,
      patientName:patient.name,
      patientDni:patient.dni||"",
      patientDate:patient.date,
      questionnaires:qList,
      type:sessionType,
      createdAt:new Date().toISOString(),
      status:"pendiente"
    };
    // Guardar la sesión en storage local
    window.storage.set("session_"+code,JSON.stringify(sessionData));
    // Construir el link al formulario
    const base=window.location.origin;
    const link=`${base}/form.html?session=${code}&type=${sessionType}&q=${qList.join(",")}&patient=${encodeURIComponent(patient.name)}`;
    setSessionLink(link);
    setSessionStatus("✅ Link generado. Copialo y envialo al paciente o familiar.");
    setTimeout(()=>setSessionStatus(""),8000);
  }

  async function verificarRespuestas(){
    if(!sessionCode){setSessionStatus("⚠ Primero generá un link de sesión.");return;}
    try{
      const r=await window.storage.get("resp_"+sessionCode);
      if(!r||!r.value){setSessionStatus("⏳ Sin respuestas todavía. El formulario aún no fue completado.");setTimeout(()=>setSessionStatus(""),5000);return;}
      const resp=JSON.parse(r.value);
      if(resp.scl90)  setScl90Data(resp.scl90);
      if(resp.srs)    setSrsData(resp.srs);
      if(resp.wurs)   setWursData(resp.wurs);
      if(resp.asrs)   setAsrsData(resp.asrs);
      if(resp.mbi)    setMbiScores(resp.mbi);
      if(resp.snap)   setSnapData(resp.snap);
      setSessionStatus("✅ Respuestas cargadas en el perfil del paciente.");
      setTimeout(()=>setSessionStatus(""),5000);
    }catch(e){setSessionStatus("❌ Error al verificar: "+e.message);}
  }

  async function saveCurrentPatient(){
    if(!patient.name){setSaveStatus("⚠ Ingresá el nombre primero.");setTimeout(()=>setSaveStatus(""),3000);return;}
    try{
      const id="pat_"+Date.now();
      const savedAt=new Date().toLocaleString("es-AR");
      const state=getAllState();
      await window.storage.set(id,JSON.stringify({id,savedAt,state}));
      let list=[];
      try{const r=await window.storage.get("patientList");list=JSON.parse(r.value);}catch(e){list=[];}
      list.push({id,name:patient.name,age:patient.age,date:patient.date,savedAt});
      await window.storage.set("patientList",JSON.stringify(list));
      setSavedPatients(list);
      setSaveStatus("✅ Paciente guardado.");
    }catch(e){
      console.error("Save error:",e);
      setSaveStatus("❌ Error: "+e.message);
    }
    setTimeout(()=>setSaveStatus(""),4000);
  }
  async function loadSavedList(){
    try{const r=await window.storage.get("patientList");setSavedPatients(JSON.parse(r.value));}catch(e){setSavedPatients([]);}
  }
  async function loadPatient(id){
    try{
      const r=await window.storage.get(id);
      const s=JSON.parse(r.value).state;
      setPatient(s.patient||{});setBriefScores(s.briefScores||{});setMocaScores(s.mocaScores||{});
      setTmtData(s.tmtData||{});setFvData(s.fvData||{});setStroopData(s.stroopData||{});
      setRavltData(s.ravltData||{});setTavecData(s.tavecData||{});setWms3Data(s.wms3Data||{});
      setMbiScores(s.mbiScores||{});setWaisData(s.waisData||{});setWcstData(s.wcstData||{});
      setIfsData(s.ifsData||{});setBadsData(s.badsData||{});setReyData(s.reyData||{copia:"",memoria:"",tipo:""});
      setSnapData(s.snapData||{});setPapdiData(s.papdiData||{libre:"",guiada:""});setBntData(s.bntData||{mode:"60",score:""});
      setScl90Data(s.scl90Data||{});setSrsData(s.srsData||{_informant:"parent",_sex:"M"});
      setWisc5Data(s.wisc5Data||{});setCarasData(s.carasData||{grade:"",A:"",E:""});setD2Data(s.d2Data||{});
      setNeuropsiData(s.neuropsiData||{});setWursData(s.wursData||{});setWursMode(s.wursMode||"25");
      setAsrsData(s.asrsData||{});setRelojData(s.relojData||{});setHotelData(s.hotelData||{});
      setAdminTests(s.adminTests||{});setWaisAttenData(s.waisAttenData||{});setTab("patient");
    }catch(e){console.error("Load error:",e);}
  }
  async function deletePatient(id){
    try{
      await window.storage.delete(id);
      const list=savedPatients.filter(p=>p.id!==id);
      await window.storage.set("patientList",JSON.stringify(list));
      setSavedPatients(list);
    }catch(e){console.error("Delete error:",e);}
  }
  useEffect(()=>{loadSavedList();},[]);

  // ─── filtros de navegación ───────────────────────────────────────────────────
  const allTests=[...TEST_CATALOG.pruebas,...TEST_CATALOG.cuestionarios];
  const domains=[...new Set(allTests.map(t=>t.domain))].sort();
  const visibleTests=allTests.filter(t=>{
    const secMatch=t.section===undefined||(section==="pruebas"?TEST_CATALOG.pruebas.some(p=>p.id===t.id):TEST_CATALOG.cuestionarios.some(c=>c.id===t.id));
    const domMatch=!domainFilter||t.domain===domainFilter;
    const srchMatch=!searchFilter||t.label.toLowerCase().includes(searchFilter.toLowerCase())||t.domain.toLowerCase().includes(searchFilter.toLowerCase());
    return secMatch&&domMatch&&srchMatch;
  });

  return(
    <div style={S.app}>
      {/* ── SIDEBAR ────────────────────────────────────────────────────── */}
      <aside style={S.sidebar}>
        {/* ── LOGO ADRIANA MELÉNDEZ ── */}
        <div style={{padding:"20px 16px 16px",borderBottom:"1px solid rgba(255,255,255,0.08)",textAlign:"center"}}>
          {logo1
            ? <img src={logo1} alt="Logo" style={{height:72,maxWidth:"90%",objectFit:"contain",display:"block",margin:"0 auto 10px"}}/>
            : <div style={{width:64,height:64,borderRadius:12,background:"rgba(237,105,116,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 10px"}}>🧠</div>
          }
          <div style={{color:"#fff",fontSize:13,fontWeight:700,fontFamily:font,letterSpacing:"0.01em"}}>Adriana Meléndez</div>
          <div style={{color:"rgba(240,192,200,0.75)",fontSize:11,fontFamily:font,fontStyle:"italic",marginTop:2}}>Lic. en Psicología</div>
          <div style={{color:"rgba(240,192,200,0.55)",fontSize:10,fontFamily:font,marginTop:1}}>M.P. 16.443</div>
        </div>

        {/* Paciente activo */}
        {patient.name&&(
          <div style={{margin:"10px 10px 4px",background:"rgba(237,105,116,0.1)",borderRadius:8,padding:"9px 12px",border:"1px solid rgba(237,105,116,0.2)"}}>
            <div style={{color:"#fff",fontSize:12,fontWeight:600,marginBottom:1,fontFamily:font}}>{patient.name}</div>
            <div style={{color:"rgba(200,216,228,0.7)",fontSize:10,fontFamily:font}}>{patient.age&&patient.age+" años · "}{patient.date}</div>
            <button onClick={saveCurrentPatient} style={{marginTop:7,width:"100%",padding:"5px 0",borderRadius:6,background:"rgba(237,105,116,0.25)",border:"1px solid rgba(237,105,116,0.4)",color:"#fff",fontSize:11,cursor:"pointer",fontWeight:600,fontFamily:font}}>
              {saveStatus||"💾 Guardar"}
            </button>
          </div>
        )}

        {/* ── NAV GENERAL ── */}
        <div style={{...S.sidebarSection,fontFamily:font}}>General</div>
        {[
          {id:"patient",  icon:"👤", label:"Paciente"},
          {id:"pacientes",icon:"💾", label:"Pacientes guardados"},
          {id:"redaccion",icon:"✍",  label:"Redacción"},
          {id:"results",  icon:"📊", label:"Resultados"},
        ].map(item=>(
          <button key={item.id} style={{...S.sidebarItem(tab===item.id),fontFamily:font,fontSize:13}} onClick={()=>setTab(item.id)}>
            <span style={{fontSize:14,opacity:0.85}}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}

        {/* ── BLOQUE: Evaluaciones neuropsicológicas ── */}
        <SidebarGroup
          label="Evaluaciones neuropsicológicas"
          items={TEST_CATALOG.pruebas}
          tab={tab} section={section}
          adminTests={adminTests}
          font={font} C={C} S={S}
          onClickGroup={()=>{setSection("catalogo-pruebas");setTab("catalogo-pruebas");}}
          onClickItem={(t)=>{setSection("pruebas");setTab(t.id);}}
        />

        {/* ── BLOQUE: Cuestionarios autoadministrados ── */}
        <SidebarGroup
          label="Cuestionarios — Autoadministrados"
          items={TEST_CATALOG.cuestionarios.filter(t=>t.group==="autoadmin"||t.group==="emocional")}
          tab={tab} section={section}
          adminTests={adminTests}
          font={font} C={C} S={S}
          onClickGroup={()=>{setSection("catalogo-auto");setTab("catalogo-auto");}}
          onClickItem={(t)=>{setSection("cuestionarios");setTab(t.id);}}
        />

        {/* ── BLOQUE: Cuestionarios heteroinforme ── */}
        <SidebarGroup
          label="Cuestionarios — Heteroinforme"
          items={TEST_CATALOG.cuestionarios.filter(t=>t.group==="familiar")}
          tab={tab} section={section}
          adminTests={adminTests}
          font={font} C={C} S={S}
          onClickGroup={()=>{setSection("catalogo-familiar");setTab("catalogo-familiar");}}
          onClickItem={(t)=>{setSection("cuestionarios");setTab(t.id);}}
        />

        <div style={{height:24}}/>
      </aside>

      {/* ── MAIN CONTENT ───────────────────────────────────────────────── */}
      <main style={S.main}>
        {/* Topbar */}
        <div style={S.topbar}>
          <div>
            <div style={{fontSize:18,fontWeight:700,color:C.textDark}}>
              {tab==="patient"?"Datos del paciente":
               tab==="pacientes"?"Pacientes guardados":
               tab==="results"?"Resultados":
               tab==="redaccion"?"Redacción del informe":
               tab==="catalogo-pruebas"?"Evaluaciones neuropsicológicas":
               tab==="catalogo-auto"?"Cuestionarios autoadministrados":
               tab==="catalogo-familiar"?"Cuestionarios — Heteroinforme":
               ALL_TABS.find(t=>t.id===tab)?.label||"Evaluación"}
            </div>
            {patient.name&&<div style={{fontSize:12,color:C.textLight,marginTop:2}}>{patient.name} · {patient.age} años · {patient.date}</div>}
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <select value={domainFilter} onChange={e=>setDomainFilter(e.target.value)} style={{padding:"6px 10px",borderRadius:7,border:`1px solid ${C.border}`,fontSize:12,background:"#f7fafc",color:C.textMid,fontFamily:font}}>
              <option value="">Todos los dominios</option>
              {DOMINIOS.map(d=><option key={d} value={d}>{d}</option>)}
            </select>
            {!patient.name&&<button onClick={()=>setTab("patient")} style={{padding:"7px 16px",borderRadius:7,background:C.primary,color:"#fff",border:"none",fontSize:12,cursor:"pointer",fontWeight:600}}>+ Nuevo paciente</button>}
          </div>
        </div>

        {/* ── CONTENIDO DE TABS ─────────────────────────────────────────── */}
        {tab==="patient"&&(
          <div>
            <div style={S.card}>
              <h3 style={S.sectionTitle}>Datos del Paciente</h3>
              <div style={S.grid2}>
                {[["name","Nombre y apellido","text"],["age","Edad (años)","number"],["date","Fecha de evaluación","date"],["reason","Motivo de consulta","text"]].map(([k,label,type])=>(
                  <div key={k} style={S.formGroup}><label style={S.label}>{label}</label><input type={type} style={S.input} value={patient[k]} onChange={e=>upPatient(k,e.target.value)} placeholder={label}/></div>
                ))}
                <div style={S.formGroup}><label style={S.label}>Sexo</label><select style={S.select} value={patient.sex} onChange={e=>upPatient("sex",e.target.value)}><option value="">—</option><option value="Masculino">Masculino</option><option value="Femenino">Femenino</option></select></div>
                <div style={S.formGroup}><label style={S.label}>Nivel educativo</label><select style={S.select} value={patient.education} onChange={e=>upPatient("education",e.target.value)}><option value="">—</option><option value="Primario incompleto">Primario incompleto</option><option value="Primario completo">Primario completo</option><option value="Secundario incompleto">Secundario incompleto</option><option value="Secundario completo">Secundario completo</option><option value="Terciario/Universitario">Terciario/Universitario</option></select></div>
                <div style={S.formGroup}><label style={S.label}>Años de escolaridad</label><input type="number" min={0} max={30} style={S.input} value={patient.educYears} onChange={e=>upPatient("educYears",e.target.value)} placeholder="Ej: 12"/></div>
              </div>
            </div>
            <div style={S.card}>
              <h3 style={S.sectionTitle}>Cuestionarios virtuales</h3>
              <p style={{fontSize:12,color:C.textLight,marginBottom:14,fontFamily:font}}>
                Generá un link personalizado que el paciente o familiar puede abrir desde su celular o computadora. Las respuestas se cargan automáticamente aquí.
              </p>

              {/* Tipo de destinatario */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,color:C.primary,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:font}}>Destinatario</div>
                <div style={{display:"flex",gap:8}}>
                  {[{v:"paciente",label:"👤 Paciente (autoadministrado)"},{v:"familiar",label:"👨‍👩‍👧 Familiar / acompañante"}].map(opt=>(
                    <label key={opt.v} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"7px 14px",borderRadius:8,border:`1.5px solid ${sessionType===opt.v?C.primary:C.border}`,background:sessionType===opt.v?`${C.primary}12`:"#fff",fontSize:12,fontFamily:font}}>
                      <input type="radio" name="sessionType" value={opt.v} checked={sessionType===opt.v} onChange={e=>setSessionType(e.target.value)} style={{accentColor:C.primary}}/>
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Cuestionarios a enviar */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:700,color:C.primary,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:font}}>Cuestionarios a enviar</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {TEST_CATALOG.cuestionarios
                    .filter(t=>sessionType==="familiar"?!t.selfReport||t.selfReport===false:t.selfReport!==false)
                    .map(t=>(
                    <label key={t.id} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"6px 12px",borderRadius:7,border:`1.5px solid ${selectedQForSend[t.id]?C.primary:C.border}`,background:selectedQForSend[t.id]?`${C.primary}12`:"#fff",fontSize:12,fontFamily:font}}>
                      <input type="checkbox" checked={!!selectedQForSend[t.id]} onChange={e=>setSelectedQForSend(p=>({...p,[t.id]:e.target.checked}))} style={{accentColor:C.primary}}/>
                      <span style={{fontWeight:600}}>{t.label.split(" — ")[0]}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Botones */}
              <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                <button onClick={generarLinkVirtual} style={{padding:"9px 20px",borderRadius:8,background:C.primary,color:"#fff",border:"none",fontFamily:font,fontWeight:700,cursor:"pointer",fontSize:13}}>
                  🔗 Generar link
                </button>
                {sessionLink&&(
                  <>
                    <button onClick={()=>{navigator.clipboard.writeText(sessionLink);setSessionStatus("📋 Link copiado.");setTimeout(()=>setSessionStatus(""),3000);}} style={{padding:"9px 16px",borderRadius:8,background:"#fff",border:`1.5px solid ${C.primary}`,fontFamily:font,fontSize:12,cursor:"pointer",color:C.primary,fontWeight:700}}>
                      📋 Copiar link
                    </button>
                    {navigator.share&&(
                      <button onClick={()=>navigator.share({title:"Cuestionario",text:"Te envío el cuestionario:",url:sessionLink})} style={{padding:"9px 16px",borderRadius:8,background:"#fff",border:`1.5px solid ${C.primary}`,fontFamily:font,fontSize:12,cursor:"pointer",color:C.primary,fontWeight:700}}>
                        📤 Compartir
                      </button>
                    )}
                    <button onClick={verificarRespuestas} style={{padding:"9px 16px",borderRadius:8,background:C.success,color:"#fff",border:"none",fontFamily:font,fontWeight:700,cursor:"pointer",fontSize:13}}>
                      🔄 Cargar respuestas
                    </button>
                  </>
                )}
              </div>

              {/* Link generado */}
              {sessionLink&&(
                <div style={{marginTop:14,padding:"12px 16px",background:`${C.bg}`,borderRadius:10,border:`1.5px dashed ${C.primary}`}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.primary,textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:font,marginBottom:6}}>Link del formulario</div>
                  <div style={{fontSize:11,fontFamily:"monospace",color:C.textDark,wordBreak:"break-all",lineHeight:1.5}}>{sessionLink}</div>
                  <div style={{fontSize:11,color:C.textLight,fontFamily:font,marginTop:8}}>
                    ✓ El link está listo para enviar por WhatsApp, email o mensaje de texto.<br/>
                    ✓ Cuando el paciente/familiar complete y envíe, clic en <strong>Cargar respuestas</strong>.
                  </div>
                </div>
              )}

              {sessionStatus&&<div style={{marginTop:10,fontFamily:font,fontSize:12,padding:"8px 12px",borderRadius:7,background:sessionStatus.startsWith("✅")||sessionStatus.startsWith("📋")?`${C.success}15`:`${C.danger}10`,color:sessionStatus.startsWith("✅")||sessionStatus.startsWith("📋")?C.success:sessionStatus.startsWith("⏳")?C.warning:C.danger}}>{sessionStatus}</div>}
            </div>
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><h3 style={{...S.sectionTitle,marginBottom:4}}>Limpiar resultados</h3><p style={{fontSize:12,color:C.textLight,margin:0}}>Borra todos los puntajes de pruebas y cuestionarios. Los datos del paciente se conservan.</p></div>
                <button onClick={limpiarResultados} style={{padding:"8px 18px",borderRadius:8,background:`${C.danger}12`,color:C.danger,border:`1.5px solid ${C.danger}40`,fontFamily:font,fontWeight:700,cursor:"pointer",fontSize:13,whiteSpace:"nowrap"}}>🗑 Limpiar resultados</button>
              </div>
            </div>
            <div style={S.card}>
              <h3 style={S.sectionTitle}>Pruebas administradas</h3>
              <p style={{fontSize:12,color:C.textLight,marginBottom:16}}>Seleccioná las pruebas efectivamente aplicadas. El informe IA solo incluirá las marcadas.</p>
              {["pruebas","cuestionarios"].map(sec=>(
                <div key={sec} style={{marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.primary,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>{sec==="pruebas"?"🧠 Pruebas cognitivas":"📋 Cuestionarios"}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {TEST_CATALOG[sec].map(t=>(
                      <label key={t.id} style={{display:"flex",alignItems:"center",gap:6,cursor:"pointer",padding:"6px 12px",borderRadius:7,border:`1.5px solid ${adminTests[t.id]?C.primary:C.border}`,background:adminTests[t.id]?`${C.primary}12`:"#fff",fontSize:12,color:C.textDark,transition:"all 0.12s"}}>
                        <input type="checkbox" checked={!!adminTests[t.id]} onChange={e=>setAdminTests(p=>({...p,[t.id]:e.target.checked}))} style={{accentColor:C.primary}}/>
                        {t.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="pacientes"&&(
          <div style={S.card}>
            <h3 style={S.sectionTitle}>Pacientes Guardados</h3>
            {savedPatients.length===0?(
              <div style={{textAlign:"center",padding:"40px 0",color:C.textLight}}>
                <div style={{fontSize:40,marginBottom:12}}>📂</div>
                <div style={{fontSize:14}}>No hay pacientes guardados todavía.</div>
              </div>
            ):(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {savedPatients.slice().reverse().map(p=>(
                  <div key={p.id} style={{border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 16px",background:"#fafafa",display:"flex",flexDirection:"column",gap:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div>
                        <div style={{fontSize:15,fontWeight:700,color:C.textDark}}>{p.name}</div>
                        <div style={{fontSize:12,color:C.textLight,marginTop:2}}>{p.age} años · {p.date}</div>
                        <div style={{fontSize:10,color:C.textLight}}>Guardado: {p.savedAt}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={()=>loadPatient(p.id)} style={{flex:1,padding:"7px 0",borderRadius:7,background:C.primary,color:"#fff",border:"none",fontSize:12,cursor:"pointer",fontWeight:600}}>Cargar</button>
                      <button onClick={()=>deletePatient(p.id)} style={{padding:"7px 14px",borderRadius:7,background:`${C.danger}12`,color:C.danger,border:`1px solid ${C.danger}30`,fontSize:12,cursor:"pointer"}}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab==="briefa"&&<BriefAForm briefScores={briefScores} setBriefScores={setBriefScores} patient={patient}/>}
        {tab==="moca"&&<MoCAForm mocaScores={mocaScores} setMocaScores={setMocaScores} patient={patient}/>}
        {tab==="tmtfv"&&<TMTFVSection patient={patient} tmtData={tmtData} setTmtData={setTmtData} fvData={fvData} setFvData={setFvData} tmtResult={results.tmt||null} fvResult={results.fv||null}/>}
        {tab==="stroop"&&<StroopForm stroopData={stroopData} setStroopData={setStroopData} patient={patient}/>}
        {tab==="ravlt"&&<RAVLTForm ravltData={ravltData} setRavltData={setRavltData} patient={patient}/>}
        {tab==="tavec"&&<TAVECForm tavecData={tavecData} setTavecData={setTavecData} patient={patient}/>}
        {tab==="wms3"&&<WMS3Form wms3Data={wms3Data} setWms3Data={setWms3Data}/>}
        {tab==="wcst"&&<WCSTForm wcstData={wcstData} setWcstData={setWcstData} patient={patient}/>}
        {tab==="ifs"&&<IFSForm ifsData={ifsData} setIfsData={setIfsData}/>}
        {tab==="waisiv"&&<WAISForm waisData={waisData} setWaisData={setWaisData} patient={patient}/>}
        {tab==="snap"&&<SNAPForm snapData={snapData} setSnapData={setSnapData}/>}
        {tab==="bads"&&<BADSForm badsData={badsData} setBadsData={setBadsData}/>}
        {tab==="rey"&&<ReyForm reyData={reyData} setReyData={setReyData}/>}
        {tab==="papdi"&&<PAPDIForm papdiData={papdiData} setPapdiData={setPapdiData} patient={patient}/>}
        {tab==="bnt"&&<BNTForm bntData={bntData} setBntData={setBntData} patient={patient}/>}
        {tab==="mbi"&&<MBISection mbiScores={mbiScores} setMbiScores={setMbiScores} mbiDone={mbiDone} sumAE={sumAE} sumD={sumD} sumRP={sumRP}/>}
        {tab==="scl90"&&<SCL90Form scl90Data={scl90Data} setScl90Data={setScl90Data} patient={patient}/>}
        {tab==="srs"&&<SRSForm srsData={srsData} setSrsData={setSrsData}/>}
        {tab==="wiscv"&&<WISC5Form wisc5Data={wisc5Data} setWisc5Data={setWisc5Data} patient={patient}/>}
        {tab==="atencion-wais"&&<WAISAttenForm waisAttenData={waisAttenData} setWaisAttenData={setWaisAttenData} patient={patient}/>}
        {tab==="caras"&&<CarasForm carasData={carasData} setCarasData={setCarasData}/>}
        {tab==="d2"&&<D2Form d2Data={d2Data} setD2Data={setD2Data} patient={patient}/>}
        {tab==="neuropsi"&&<NeuropsiForm neuropsiData={neuropsiData} setNeuropsiData={setNeuropsiData}/>}
        {tab==="wurs"&&<WURSForm wursData={wursData} setWursData={setWursData} wursMode={wursMode} setWursMode={setWursMode}/>}
        {tab==="asrs"&&<ASRSForm asrsData={asrsData} setAsrsData={setAsrsData}/>}
        {tab==="reloj"&&<RelojForm relojData={relojData} setRelojData={setRelojData}/>}
        {tab==="hotel"&&<HotelForm hotelData={hotelData} setHotelData={setHotelData} patient={patient}/>}
        {tab==="redaccion"&&<InformeEditor results={results} patient={patient}/>}
        {tab==="results"&&<ResultsPanel results={results} patient={patient} adminTests={adminTests}/>}
        {(tab==="catalogo-pruebas"||tab==="catalogo-auto"||tab==="catalogo-familiar")&&(
          <TestCatalogView
            items={
              tab==="catalogo-pruebas"?TEST_CATALOG.pruebas:
              tab==="catalogo-auto"?TEST_CATALOG.cuestionarios.filter(t=>t.group==="autoadmin"||t.group==="emocional"):
              TEST_CATALOG.cuestionarios.filter(t=>t.group==="familiar")
            }
            domainFilter={domainFilter}
            adminTests={adminTests}
            font={font} C={C} S={S}
            onSelectTest={(t)=>{
              setSection(TEST_CATALOG.pruebas.some(p=>p.id===t.id)?"pruebas":"cuestionarios");
              setTab(t.id);
            }}
          />
        )}
      </main>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── TMT + FV SECTION (top-level) ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function TMTFVSection({patient,tmtData,setTmtData,fvData,setFvData,tmtResult,fvResult}){
  const age=parseInt(patient.age)||0;
  const tmtAg=getTMTAgeGroup(age);
  const tmtNorm=tmtAg?TMT_AGE_NORMS[tmtAg]:null;
  const fvAg=getFVAgeGroup(age);
  const fvEdL=getEdLevelFV(patient.education);
  const fvNorm=fvAg&&fvEdL?FV_NORMS_ALLEGRI[fvAg]?.[fvEdL]:null;
  return(
    <div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>🔗 TMT — Trail Making Test</h3>
        <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Tombaugh (2004). Baremos por edad (18-89 años). Z = (M – tiempo) / DS.</p>
        {tmtNorm&&<p style={{fontFamily:font,fontSize:13,color:C.textMid,margin:"0 0 16px"}}>Grupo: {tmtAg} · Media A: {tmtNorm.A.mean}s · Media B: {tmtNorm.B.mean}s</p>}
        <div style={S.grid2}>
          {[{part:"A",desc:"Secuencia numérica (1-25)"},{part:"B",desc:"Alternancia números-letras"}].map(({part,desc})=>{
            const zKey=`z${part}`;
            const zVal=tmtResult?tmtResult[zKey]:null;
            const cls=zVal!==null?classifyZ(zVal,true):null;
            return(
              <div key={part} style={{border:`2px solid ${C.border}`,borderRadius:12,padding:16}}>
                <div style={{background:part==="A"?C.primary:C.dark,color:"white",borderRadius:8,padding:"8px 16px",marginBottom:12,fontWeight:700,fontFamily:font}}>Parte {part} — {desc}</div>
                <div style={S.formGroup}><label style={S.label}>Tiempo (segundos)</label><input type="number" min={0} max={600} style={S.input} value={tmtData[`time${part}`]||""} onChange={e=>setTmtData(d=>({...d,[`time${part}`]:e.target.value}))} placeholder="Ej: 45"/></div>
                <div style={S.formGroup}><label style={S.label}>Errores</label><input type="number" min={0} style={S.input} value={tmtData[`errors${part}`]||""} onChange={e=>setTmtData(d=>({...d,[`errors${part}`]:e.target.value}))} placeholder="0"/></div>
                {cls&&zVal!==null&&(
                  <div style={{background:`${cls?cls.color:"transparent"}15`,borderRadius:8,padding:"8px 12px"}}>
                    <span style={{fontFamily:font,fontWeight:700,color:cls?cls.color:C.textLight}}>Z={zVal>0?"+":""}{zVal}</span>
                    <span style={{...S.badge(cls?cls.color:C.textLight),marginLeft:8}}>{cls?cls.label:"—"}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div style={S.card}>
        <h3 style={S.sectionTitle}>🔤 Fluidez Verbal — Semántica y Fonológica</h3>
        <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 4px"}}>Butman, Allegri et al. (2000). Baremos: edad × escolaridad. Población argentina.</p>
        {fvNorm&&<p style={{fontFamily:font,fontSize:13,color:C.textMid,margin:"0 0 16px"}}>Grupo: {fvAg} · {fvEdL} · Sem. M={fvNorm.sem.mean} DS={fvNorm.sem.sd} · Fon. M={fvNorm.fon.mean} DS={fvNorm.fon.sd}</p>}
        {!fvNorm&&patient.education&&<p style={{fontFamily:font,fontSize:13,color:C.warning,margin:"0 0 16px"}}>⚠ Ingresá la edad del paciente para ver baremos.</p>}
        {!patient.education&&<p style={{fontFamily:font,fontSize:13,color:C.warning,margin:"0 0 16px"}}>⚠ Seleccioná el nivel educativo del paciente para que aparezcan los baremos.</p>}
        <div style={S.grid2}>
          {[{k:"semantic",label:"Semántica — Animales / 1 min"},{k:"phonologic",label:'Fonológica — Letra "P" / 1 min'}].map(({k,label})=>{
            const zKey=k==="semantic"?"zSem":"zFon";
            const zVal=fvResult?fvResult[zKey]:null;
            const cls=zVal!==null?classifyZ(zVal):null;
            return(
              <div key={k} style={{border:`2px solid ${C.border}`,borderRadius:12,padding:16}}>
                <div style={{background:k==="semantic"?C.primary:C.dark,color:"white",borderRadius:8,padding:"8px 16px",marginBottom:12,fontWeight:700,fontFamily:font}}>{label}</div>
                <div style={S.formGroup}><label style={S.label}>N° de palabras</label><input type="number" min={0} max={80} style={S.input} value={fvData[k]||""} onChange={e=>setFvData(d=>({...d,[k]:e.target.value}))} placeholder="Ej: 18"/></div>
                {cls&&zVal!==null&&(
                  <div style={{background:`${cls?cls.color:"transparent"}15`,borderRadius:8,padding:"8px 12px"}}>
                    <span style={{fontFamily:font,fontWeight:700,color:cls?cls.color:C.textLight}}>Z={zVal>0?"+":""}{zVal}</span>
                    <span style={{...S.badge(cls?cls.color:C.textLight),marginLeft:8}}>{cls?cls.label:"—"}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── MBI SECTION (top-level) ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function MBISection({mbiScores,setMbiScores,mbiDone,sumAE,sumD,sumRP}){
  const SubGroup=({sub,label,color})=>(
    <div style={{marginBottom:20}}>
      <div style={{background:color,color:"white",padding:"8px 16px",borderRadius:"8px 8px 0 0",fontWeight:700,fontFamily:font,fontSize:14}}>{label}</div>
      <div style={{border:`1px solid ${C.border}`,borderTop:"none",borderRadius:"0 0 8px 8px"}}>
        {MBI_ITEMS.filter(i=>i.sub===sub).map((item,idx)=>(
          <div key={item.num} style={{padding:"10px 16px",background:idx%2===0?"#fff":"#fdf6f7",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontFamily:font,fontSize:13,color:C.textDark,marginBottom:8}}><strong>{item.num}.</strong> {item.text}</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {MBI_SCALE.map((lbl,val)=>(
                <button key={val} onClick={()=>setMbiScores(s=>({...s,[item.num]:val}))} style={{padding:"5px 10px",fontSize:11,fontFamily:font,borderRadius:6,cursor:"pointer",border:`2px solid ${mbiScores[item.num]===val?color:C.border}`,background:mbiScores[item.num]===val?color:"#fff",color:mbiScores[item.num]===val?"white":C.textMid,fontWeight:mbiScores[item.num]===val?700:400}}>{val} — {lbl}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  const mbiSummary=[
    {sub:"AE",sum:sumAE,max:54,color:"#991b1b"},
    {sub:"D",sum:sumD,max:30,color:"#b45309"},
    {sub:"RP",sum:sumRP,max:48,color:C.success},
  ];
  return(
    <div style={S.card}>
      <h3 style={S.sectionTitle}>🔥 MBI — Inventario de Burnout de Maslach</h3>
      <p style={{fontFamily:font,fontSize:13,color:C.textLight,margin:"0 0 16px"}}>Maslach & Jackson (1981). AE + D + RP. Alto AE + Alta D + Bajo RP = Burnout.</p>
      {mbiDone&&(
        <div style={S.grid3}>
          {mbiSummary.map(s=>{
            const cls=classifyMBI(s.sub,s.sum);
            return(
              <div key={s.sub} style={S.indexBox}>
                <div style={{fontSize:10,fontWeight:700,fontFamily:font,color:C.textLight}}>{s.sub}</div>
                <div style={{fontSize:28,fontWeight:800,fontFamily:font,color:cls?cls.color:C.textLight}}>{s.sum}/{s.max}</div>
                <span style={S.badge(cls?cls.color:C.textLight)}>{cls.level}</span>
              </div>
            );
          })}
        </div>
      )}
      <SubGroup sub="AE" label="AGOTAMIENTO EMOCIONAL (AE) — máx. 54" color="#991b1b"/>
      <SubGroup sub="D"  label="DESPERSONALIZACIÓN (D) — máx. 30" color="#b45309"/>
      <SubGroup sub="RP" label="REALIZACIÓN PERSONAL (RP) — máx. 48 (invertida)" color={C.success}/>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── RESULTS PANEL (top-level) ───────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// ─── ANEXO — PROTOCOLO DE VALORACIÓN COGNITIVA ───────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
function AnexoTable({results,patient,adminTests}){
  // Columnas de escala: -3,-2,-1.5,-1,-0.5,0,0.5,1,1.5,2,3
  const COLS=[-3,-2,-1.5,-1,-0.5,0,0.5,1,1.5,2,3];

  function markCol(z){
    if(z===null||z===undefined||isNaN(z)) return null;
    const zf=parseFloat(z);
    // Encontrar la columna más cercana
    let best=0,bestDist=999;
    COLS.forEach((c,i)=>{const d=Math.abs(c-zf);if(d<bestDist){bestDist=d;best=i;}});
    return best;
  }

  function Row({label,pb,z,pc,interp,dimColor}){
    const zf=z!==null&&z!==undefined&&!isNaN(parseFloat(z))?parseFloat(z):null;
    const marked=zf!==null?markCol(zf):null;
    const dangerZ=zf!==null&&zf<=-1;
    return(
      <tr>
        <td style={{padding:"3px 8px",fontFamily:font,fontSize:11,borderBottom:"1px solid #e0e0e0",color:dimColor||"#333",paddingLeft:dimColor?"20px":"8px"}}>{label}</td>
        <td style={{padding:"3px 8px",textAlign:"center",fontFamily:font,fontSize:11,borderBottom:"1px solid #e0e0e0"}}>{pb!==null&&pb!==undefined?pb:"—"}</td>
        <td style={{padding:"3px 8px",textAlign:"center",fontFamily:font,fontSize:11,fontWeight:dangerZ?700:400,color:dangerZ?"#c00":"#333",borderBottom:"1px solid #e0e0e0"}}>{zf!==null?zf.toFixed(2):"—"}</td>
        {pc!==undefined&&<td style={{padding:"3px 8px",textAlign:"center",fontFamily:font,fontSize:11,borderBottom:"1px solid #e0e0e0"}}>{pc!==null&&pc!==undefined?pc:"—"}</td>}
        {COLS.map((c,i)=>(
          <td key={c} style={{padding:"2px 0",textAlign:"center",fontSize:10,borderBottom:"1px solid #e0e0e0",borderLeft:c===0?"2px solid #999":"1px solid #ddd",background:c<-1.5?"#ffe8e8":c>1.5?"#e8f5e9":c===0?"#f5f5f5":"#fff",minWidth:22,width:22}}>
            {marked===i?<span style={{fontWeight:900,color:dangerZ?"#c00":"#333",fontSize:12}}>X</span>:""}
          </td>
        ))}
        {interp!==undefined&&<td style={{padding:"3px 8px",fontFamily:font,fontSize:10,borderBottom:"1px solid #e0e0e0",color:"#555"}}>{interp||""}</td>}
      </tr>
    );
  }

  function SectionHeader({label}){
    return(
      <tr>
        <td colSpan={3+COLS.length+1} style={{padding:"5px 8px",fontFamily:font,fontSize:11,fontWeight:700,background:"#e8e8e8",borderBottom:"1px solid #ccc",borderTop:"2px solid #aaa"}}>{label}</td>
      </tr>
    );
  }

  // Recolectar todas las filas según pruebas disponibles
  const sections=[];

  // ── Screening ────────────────────────────────────────────────────────────
  const screenRows=[];
  if(results.moca){
    const pc=results.moca.adjusted;
    screenRows.push({label:"MoCA",pb:results.moca.total+"/30",z:null,pc:"≥26=Normal",interp:results.moca.label});
  }
  if(results.neuropsi){
    screenRows.push({label:"NEUROPSI",pb:results.neuropsi.total+"/122",z:null,interp:`${Math.round(results.neuropsi.total/1.22)}%`});
  }
  if(results.reloj){
    if(results.reloj.tro!==null) screenRows.push({label:"Test del Reloj (orden)",pb:results.reloj.tro+"/10",z:null,interp:results.reloj.tro<=6?"⚠ Positivo":"Normal"});
    if(results.reloj.trc!==null) screenRows.push({label:"Test del Reloj (copia)",pb:results.reloj.trc+"/10",z:null,interp:results.reloj.trc<=8?"⚠ Positivo":"Normal"});
  }
  if(screenRows.length) sections.push({title:"Pruebas de Screening",rows:screenRows,hasPC:false,hasInterp:true});

  // ── Inteligencia ─────────────────────────────────────────────────────────
  const intRows=[];
  if(results.wais){
    WAIS_INDEXES.filter(i=>results.wais[i.key]&&parseInt(results.wais[i.key])>0).forEach(i=>{
      const v=parseInt(results.wais[i.key]);
      const z=(v-100)/15;
      intRows.push({label:"WAIS-IV — "+i.label,pb:v,z:z,interp:classifyWAIS(v).label});
    });
  }
  if(results.wisc5){
    WISC5_INDEXES.filter(i=>i.type==="principal"&&results.wisc5.indexes[i.key]).forEach(i=>{
      const r=results.wisc5.indexes[i.key];
      const z=(r.val-100)/15;
      intRows.push({label:"WISC-V — "+i.label,pb:r.val,z:z,interp:r&&r.cls?r.cls.label:"—"});
    });
  }
  if(intRows.length) sections.push({title:"Inteligencia",rows:intRows,hasPC:false,hasInterp:true});

  // ── Atención ─────────────────────────────────────────────────────────────
  const atRows=[];
  if(results.tmt&&results.tmt.timeA){const t=results.tmt;atRows.push({label:"TMT-A",pb:t.timeA+"s",z:t.zA});if(t.timeB)atRows.push({label:"TMT-B",pb:t.timeB+"s",z:t.zB});}
  if(results.stroop){const s=results.stroop;
    if(s.rawP) atRows.push({label:"Stroop — P (Palabras)",pb:s.rawP,z:s.zP!==undefined?s.zP:null});
    if(s.rawC) atRows.push({label:"Stroop — C (Colores)",pb:s.rawC,z:s.zC!==undefined?s.zC:null});
    if(s.rawPC) atRows.push({label:"Stroop — PC (Color-Palabra)",pb:s.rawPC,z:s.zPC!==undefined?s.zPC:null});
    if(s.interference!==undefined) atRows.push({label:"Stroop — Interferencia",pb:s.interference,z:s.zInterf!==undefined?s.zInterf:null});
  }
  if(results.caras){atRows.push({label:"CARAS-R — A-E",pb:results.caras.AE,z:results.caras.zAE,interp:"En="+results.caras.eneatipo});}
  if(atRows.length) sections.push({title:"Atención y Velocidad de Procesamiento",rows:atRows,hasPC:false,hasInterp:false});

  // ── Memoria Verbal ────────────────────────────────────────────────────────
  const mvRows=[];
  if(results.ravlt){
    const rv=results.ravlt;
    ["A1","A2","A3","A4","A5","A6","A7"].forEach(k=>{if(rv.scores&&rv.scores[k]!==undefined&&rv.scores[k]!=="")mvRows.push({label:"RAVLT — "+k,pb:rv.scores[k],z:null});});
  }
  if(results.tavec){
    const tv=results.tavec;
    if(tv.scores){
      const tvMap={A1:"RI-A1",A5:"RI-A5",AT:"RI-AT",B:"RI-B",CP:"RL-CP",RCPCP:"RCL-CP",LP:"RL-LP",RCPLP:"RCL-LP",P:"P",LRL:"L-LRL",LRCL:"L-RCL",recAc:"Reconocimiento",FP:"FP",disc:"Discriminabilidad"};
      Object.entries(tv.scores).forEach(([k,v])=>{
        if(v!==undefined&&v!==""){
          const n=TAVEC_NORMS?.[tv.ag]?.[k];
          const z=n?parseFloat(((parseFloat(v)-n.m)/n.sd).toFixed(2)):null;
          mvRows.push({label:"TAVEC — "+(tvMap[k]||k),pb:v,z:z});
        }
      });
    }
  }
  if(mvRows.length) sections.push({title:"Memoria Verbal",rows:mvRows,hasPC:false,hasInterp:false});

  // ── Memoria Visual / Visuoconstrucción ────────────────────────────────────
  const mmvRows=[];
  if(results.rey){
    const r=results.rey;
    if(r.copia!==null) mmvRows.push({label:"Rey-Osterrieth — Copia",pb:r.copia+"/36",z:null,interp:r.copiaPC?"P"+r.copiaPC:""});
    mmvRows.push({label:"Rey-Osterrieth — Tipo",pb:r.tipo?"I".repeat(0)+"Tipo "+r.tipo:null,z:null,interp:"—"});
    if(r.memoria!==null) mmvRows.push({label:"Rey-Osterrieth — Memoria diferida",pb:r.memoria+"/36",z:null,interp:r.memoriaPC?"P"+r.memoriaPC:""});
    if(r.retencion!==null) mmvRows.push({label:"Rey-Osterrieth — Retención",pb:r.retencion+"%",z:null});
  }
  if(results.wms3){
    WMS3_INDEXES.filter(i=>results.wms3[i.key]).forEach(i=>{
      const v=parseInt(results.wms3[i.key]);const z=(v-100)/15;
      mmvRows.push({label:"WMS-III — "+i.label,pb:v,z:z,interp:classifyWMS(v)?classifyWMS(v).label:""});
    });
  }
  if(mmvRows.length) sections.push({title:"Memoria No Verbal y Visuoconstrucción",rows:mmvRows,hasPC:false,hasInterp:true});

  // ── Lenguaje ──────────────────────────────────────────────────────────────
  const langRows=[];
  if(results.fv){
    if(results.fv.semantic) langRows.push({label:"Fluidez Verbal Semántica",pb:results.fv.semantic,z:results.fv.zSem});
    if(results.fv.phonologic) langRows.push({label:"Fluidez Verbal Fonológica",pb:results.fv.phonologic,z:results.fv.zFon});
  }
  if(results.papdi) langRows.push({label:"PAPDI — Denominación espontánea",pb:results.papdi.score+"/30",z:results.papdi.z,interp:results.papdi.label});
  if(results.bnt){
    if(results.bnt.mode==="60") langRows.push({label:"BNT-60",pb:results.bnt.score+"/60",z:results.bnt.z,interp:results.bnt.label});
    else langRows.push({label:"BNT-12",pb:results.bnt.score+"/12",z:null,interp:results.bnt.label});
  }
  if(langRows.length) sections.push({title:"Lenguaje",rows:langRows,hasPC:false,hasInterp:true});

  // ── Funciones Ejecutivas ──────────────────────────────────────────────────
  const feRows=[];
  if(results.tmt&&results.tmt.timeB) feRows.push({label:"TMT-B",pb:results.tmt.timeB+"s",z:results.tmt.zB});
  if(results.tmt&&results.tmt.zBminusA!==undefined) feRows.push({label:"TMT — Índice B-A",pb:"",z:results.tmt.zBminusA});
  if(results.stroop&&results.stroop.interference!==undefined) feRows.push({label:"Stroop — Interferencia",pb:results.stroop.interference,z:results.stroop.zInterf!==undefined?results.stroop.zInterf:null});
  if(results.wcst){
    const ag=results.wcst.ageGroup;const n=ag?WCST_NORMS[ag]:null;const sc=results.wcst.scores;
    if(sc.categories!==undefined){const z=n?parseFloat(((parseFloat(sc.categories)-n.categories.m)/n.categories.s).toFixed(2)):null;feRows.push({label:"WCST — Categorías",pb:sc.categories,z:z});}
    if(sc.totalErrors!==undefined){const z=n?parseFloat(((parseFloat(sc.totalErrors)-n.totalErrors.m)/n.totalErrors.s).toFixed(2)):null;feRows.push({label:"WCST — Errores totales",pb:sc.totalErrors,z:z?-z:null});}
    if(sc.persevErrors!==undefined){const z=n?parseFloat(((parseFloat(sc.persevErrors)-n.persevErrors.m)/n.persevErrors.s).toFixed(2)):null;feRows.push({label:"WCST — Errores perseverativos",pb:sc.persevErrors,z:z?-z:null});}
  }
  if(results.ifs) feRows.push({label:"IFS — Total",pb:results.ifs.total.toFixed(1)+"/30",z:null,interp:results.ifs.below?"< corte (25)":"Normal"});
  if(results.bads) feRows.push({label:"BADS — Perfil",pb:results.bads.total+"/24",z:results.bads.z,interp:results.bads.label});
  if(results.hotel&&results.hotel.norm){
    const hn=results.hotel.norm;const hd=results.hotel.data;
    if(hd.tareas) feRows.push({label:"Hotel — Tareas realizadas",pb:hd.tareas,z:parseFloat(((parseFloat(hd.tareas)-hn.tareasM)/hn.tareasSD).toFixed(2))});
    if(hd.tiempoDesvio) feRows.push({label:"Hotel — Desvío tiempo",pb:hd.tiempoDesvio+"s",z:-parseFloat(((parseFloat(hd.tiempoDesvio)-hn.tiempoM)/hn.tiempoSD).toFixed(2))});
  }
  if(feRows.length) sections.push({title:"Función Ejecutiva",rows:feRows,hasPC:false,hasInterp:true});

  // ── WAIS subpruebas (Memoria de Trabajo, Velocidad, etc.) ────────────────
  // Incluidas arriba en Atención (dígitos) — ya cubierto

  if(sections.length===0) return null;

  return(
    <div id="anexo-print-area">
      <div style={{textAlign:"center",marginBottom:12}}>
        <div style={{fontFamily:"Times New Roman,serif",fontSize:14,fontWeight:700}}>ANEXO</div>
        <div style={{fontFamily:"Times New Roman,serif",fontSize:12,fontWeight:700}}>Protocolo de Valoración Cognitiva</div>
        {patient.name&&<div style={{fontFamily:"Times New Roman,serif",fontSize:11,marginTop:4}}>Paciente: {patient.name} | Fecha: {patient.date}</div>}
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"Arial,sans-serif"}}>
        <thead>
          <tr style={{background:"#333",color:"white"}}>
            <th style={{padding:"5px 8px",textAlign:"left",minWidth:200}}>Test</th>
            <th style={{padding:"5px 4px",textAlign:"center",width:40}}>PB</th>
            <th style={{padding:"5px 4px",textAlign:"center",width:40}}>Z</th>
            {COLS.map(c=><th key={c} style={{padding:"3px 0",textAlign:"center",fontSize:9,width:22,borderLeft:c===0?"2px solid #fff":"1px solid #555"}}>{c}</th>)}
            <th style={{padding:"5px 8px",textAlign:"left",minWidth:140}}>Interpretación</th>
          </tr>
        </thead>
        <tbody>
          {sections.map(sec=>(
            <>
              <SectionHeader key={"hdr_"+sec.title} label={sec.title}/>
              {sec.rows.map((row,ri)=>(
                <Row key={sec.title+ri} label={row.label} pb={row.pb} z={row.z} interp={row.interp}/>
              ))}
            </>
          ))}
        </tbody>
      </table>
      <div style={{fontFamily:"Arial,sans-serif",fontSize:9,color:"#666",marginTop:8}}>
        Zona sombreada roja (Z ≤ -1.5): rendimiento inferior esperado · Zona central (Z = 0): promedio normativo · Zona verde (Z ≥ 1.5): superior al promedio
      </div>
    </div>
  );
}

function ResultsPanel({results,patient,adminTests}){
  const summaryRows=[];
  if(results.briefa){
    const{BRI,MI,GEC}=results.briefa;
    summaryRows.push({test:"BRIEF-A",items:[
      {label:"BRI",val:`T=${BRI.t}`,color:classifyT(BRI.t).color},
      {label:"MI",val:`T=${MI.t}`,color:classifyT(MI.t).color},
      {label:"GEC",val:`T=${GEC.t}`,color:classifyT(GEC.t).color},
    ]});
  }
  if(results.wais){
    const rows=WAIS_INDEXES.filter(idx=>results.wais[idx.key]&&parseInt(results.wais[idx.key])>0).map(idx=>{
      const cls=classifyWAIS(results.wais[idx.key]);
      return{label:idx.short,val:`${results.wais[idx.key]} — ${cls?cls.label:"—"} (Pc${waisPct(results.wais[idx.key])})`,color:cls?cls.color:C.textLight};
    });
    if(rows.length) summaryRows.push({test:"WAIS-IV",items:rows});
  }
  if(results.moca){
    summaryRows.push({test:"MoCA",items:[
      {label:"Total ajust.",val:`${results.moca.adjusted}/30`,color:results.moca.color},
      {label:"Diagnóstico",val:results.moca.label,color:results.moca.color},
    ]});
  }
  if(results.tmt){
    const rows=[];
    if(results.tmt.zA!==null&&results.tmt.zA!==undefined) rows.push({label:"TMT-A",val:`Z=${results.tmt.zA}`,color:results.tmt.classA.color});
    if(results.tmt.zB!==null&&results.tmt.zB!==undefined) rows.push({label:"TMT-B",val:`Z=${results.tmt.zB}`,color:results.tmt.classB.color});
    if(rows.length) summaryRows.push({test:"TMT",items:rows});
  }
  if(results.fv){
    const rows=[];
    if(results.fv.zSem!==null&&results.fv.zSem!==undefined) rows.push({label:"FV Semántica",val:`Z=${results.fv.zSem}`,color:classifyZ(results.fv.zSem).color});
    if(results.fv.zFon!==null&&results.fv.zFon!==undefined) rows.push({label:"FV Fonológica",val:`Z=${results.fv.zFon}`,color:classifyZ(results.fv.zFon).color});
    if(rows.length) summaryRows.push({test:"Fluidez Verbal",items:rows});
  }
  if(results.stroop){
    const s=results.stroop;
    const rows=[];
    if(s.zP!==null) rows.push({label:"P",val:`Z=${s.zP>0?"+":""}${s.zP}`,color:classifyZ(s.zP).color});
    else if(s.tP) rows.push({label:"P",val:`T=${s.tP}`,color:classifyT(s.tP).color});
    if(s.zC!==null) rows.push({label:"C",val:`Z=${s.zC>0?"+":""}${s.zC}`,color:classifyZ(s.zC).color});
    else if(s.tC) rows.push({label:"C",val:`T=${s.tC}`,color:classifyT(s.tC).color});
    if(s.zPC!==null) rows.push({label:"PC",val:`Z=${s.zPC>0?"+":""}${s.zPC}`,color:classifyZ(s.zPC).color});
    else if(s.tPC) rows.push({label:"PC",val:`T=${s.tPC}`,color:classifyT(s.tPC).color});
    if(s.zInterf!==null) rows.push({label:"Interf.",val:`Z=${s.zInterf>0?"+":""}${s.zInterf}`,color:classifyZ(s.zInterf).color});
    if(rows.length) summaryRows.push({test:"Stroop",items:rows});
  }
  if(results.ravlt&&results.ravlt.adultNorm){
    const sc=results.ravlt.scores;
    const an=results.ravlt.adultNorm;
    const rows=[];
    ["A1","A5","A7"].forEach(k=>{
      if(sc[k]&&an[k]){const z=zScore(parseInt(sc[k]),an[k].m,an[k].s);if(z!==null)rows.push({label:k,val:`${sc[k]} (Z=${z})`,color:classifyZ(z).color});}
    });
    if(rows.length) summaryRows.push({test:"RAVLT",items:rows});
  }
  if(results.tavec&&results.tavec.norm){
    const sc=results.tavec.scores;const nm=results.tavec.norm;
    const rows=[];
    [["A5","A5"],["rlld","Rec. LP libre"],["recog","Reconocimiento"]].forEach(([k,lbl])=>{
      if(sc[k]&&nm[k]){const z=zScore(parseInt(sc[k]),nm[k].m,nm[k].s);if(z!==null)rows.push({label:lbl,val:`${sc[k]} (Z=${z})`,color:classifyZ(z).color});}
    });
    if(rows.length) summaryRows.push({test:"TAVEC",items:rows});
  }
  if(results.wms3){
    const rows=WMS3_INDEXES.filter(i=>results.wms3[i.key]).map(i=>{
      const cls=classifyWMS(results.wms3[i.key]);
      return cls?{label:i.short,val:`${cls.score} — ${cls?cls.label:"—"}`,color:cls?cls.color:C.textLight}:null;
    }).filter(Boolean);
    if(rows.length) summaryRows.push({test:"WMS-III",items:rows});
  }
  if(results.wcst){
    const ag=results.wcst.ageGroup;
    const norm=ag?WCST_NORMS[ag]:null;
    const rows=[];
    [{key:"categories",label:"Cat.",inv:false},{key:"totalErrors",label:"Err.Tot.",inv:true},{key:"persevErrors",label:"Err.Persev.",inv:true}].forEach(({key,label,inv})=>{
      const raw=results.wcst.scores[key];
      if(raw!==undefined&&raw!==""&&norm){
        const z=zScore(parseFloat(raw),norm[key].m,norm[key].s);
        if(z!==null) rows.push({label,val:`${raw} (Z=${z>0?"+":""}${z})`,color:classifyZ(z,inv).color});
      }
    });
    if(rows.length) summaryRows.push({test:"WCST",items:rows});
  }
  if(results.ifs){
    summaryRows.push({test:"IFS",items:[
      {label:"Total",val:`${results.ifs.total.toFixed(1)}/30`,color:results.ifs.below?C.danger:C.success},
      {label:"ÍMT",val:`${results.ifs.wm}/10`,color:C.primary},
    ]});
  }
  if(results.mbi){
    summaryRows.push({test:"MBI",items:[
      {label:"AE",val:`${results.mbi.sumAE}/54 — ${results.mbi.clsAE.level}`,color:results.mbi.clsAE.color},
      {label:"D",val:`${results.mbi.sumD}/30 — ${results.mbi.clsD.level}`,color:results.mbi.clsD.color},
      {label:"RP",val:`${results.mbi.sumRP}/48 — ${results.mbi.clsRP.level}`,color:results.mbi.clsRP.color},
    ]});
  }

  return(
    <div>
      {summaryRows.length>0?(
        <div style={{...S.card,border:`2px solid ${C.primary}30`,marginBottom:20}}>
          <h3 style={{...S.sectionTitle,marginBottom:12}}>📋 Resumen de puntuaciones cargadas</h3>
          <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:"0 0 14px"}}>Se actualiza automáticamente a medida que cargás datos en cada prueba.</p>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            {summaryRows.map(row=>(
              <div key={row.test} style={{display:"flex",alignItems:"flex-start",gap:0,borderBottom:`1px solid ${C.border}`,paddingBottom:8,marginBottom:8}}>
                <div style={{fontFamily:font,fontWeight:700,fontSize:13,color:C.textMid,minWidth:130,paddingTop:2}}>{row.test}</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,flex:1}}>
                  {row.items.map(item=>(
                    <span key={item.label} style={{fontFamily:font,fontSize:12,background:`${item.color}15`,border:`1px solid ${item.color}40`,borderRadius:6,padding:"2px 10px",color:item.color,fontWeight:600}}>
                      {item.label}: {item.val}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ):(
        <div style={{...S.card,textAlign:"center",padding:"32px 20px",color:C.textLight,fontFamily:font}}>
          <div style={{fontSize:32,marginBottom:12}}>📊</div>
          <p style={{margin:0,fontSize:14}}>Aún no hay datos cargados. Completá las pruebas en las pestañas anteriores y los resultados aparecerán aquí automáticamente.</p>
        </div>
      )}
      <RadarChart results={results}/>
      {results.briefa&&(
        <div style={S.card}>
          <h3 style={S.sectionTitle}>🧠 BRIEF-A</h3>
          <div style={S.grid3}>
            {[{label:"BRI (Reg. Conductual)",r:results.briefa.BRI},{label:"MI (Metacognición)",r:results.briefa.MI},{label:"GEC (Global Ejecutivo)",r:results.briefa.GEC}].map(({label,r})=>(
              <div key={label} style={S.indexBox}>
                <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>{label}</div>
                <div style={{fontSize:36,fontWeight:800,fontFamily:font,color:classifyT(r.t).color}}>{r.t!==null&&r.t!==undefined?r.t:'—'}</div>
                <span style={S.badge(classifyT(r.t).color)}>{r.label}</span>
                <TBar t={r.t}/>
              </div>
            ))}
          </div>
          <ClinicalInterpBlock testId="briefa" results={results} patient={patient} source="Roth et al. (2005). BRIEF-A. PAR. | Robles Bermejo (2023). TDAH: perfil neuropsicológico. An Pediatría. | Tirapu-Ustárroz & Luna-Lario. Neuropsicología de las Funciones Ejecutivas."/>
        </div>
      )}
      {results.moca&&(
        <div style={S.card}><h3 style={S.sectionTitle}>🔬 MoCA</h3>
          <div style={{display:"flex",gap:20,alignItems:"center"}}>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>PUNTAJE AJUSTADO</div>
              <div style={{fontSize:40,fontWeight:800,fontFamily:font,color:results.moca.color}}>{results.moca.adjusted}/30</div>
              <span style={S.badge(results.moca.color)}>{results.moca.label}</span>
            </div>
          </div>
        </div>
      )}
      {results.tmt&&(
        <div style={S.card}><h3 style={S.sectionTitle}>🔗 TMT</h3>
          <div style={S.grid3}>
            {[
              {label:"TMT-A",v:results.tmt.timeA?`${results.tmt.timeA}s`:"—",z:results.tmt.zA,cls:results.tmt.classA},
              {label:"TMT-B",v:results.tmt.timeB?`${results.tmt.timeB}s`:"—",z:results.tmt.zB,cls:results.tmt.classB},
              {label:"B–A (Flex.)",v:(results.tmt.timeA&&results.tmt.timeB)?`${(results.tmt.timeB-results.tmt.timeA).toFixed(0)}s`:"—",z:results.tmt.zBminusA,cls:results.tmt.classDiff},
            ].map(it=>(
              <div key={it.label} style={S.indexBox}>
                <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>{it.label}</div>
                <div style={{fontSize:28,fontWeight:800,fontFamily:font,color:it.cls?it.cls.color:C.primary}}>{it.v}</div>
                <div style={{fontSize:13,fontFamily:font}}>Z={(it.z!==null&&it.z!==undefined)?(it.z>0?"+":"")+it.z:"—"}</div>
                <span style={S.badge(it.cls?it.cls.color:C.textLight)}>{it.cls?it.cls.label:"—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {results.fv&&(results.fv.zSem!==null||results.fv.zFon!==null)&&(
        <div style={S.card}><h3 style={S.sectionTitle}>🔤 Fluidez Verbal</h3>
          <div style={S.grid2}>
            {results.fv.zSem!==null&&(
              <div style={S.indexBox}>
                <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>SEMÁNTICA</div>
                <div style={{fontSize:36,fontWeight:800,fontFamily:font,color:classifyZ(results.fv.zSem).color}}>{results.fv.semantic}</div>
                <div style={{fontSize:13,fontFamily:font}}>Z={results.fv.zSem>0?"+":""}{results.fv.zSem}</div>
                <span style={S.badge(classifyZ(results.fv.zSem).color)}>{classifyZ(results.fv.zSem).label}</span>
              </div>
            )}
            {results.fv.zFon!==null&&(
              <div style={S.indexBox}>
                <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>FONOLÓGICA</div>
                <div style={{fontSize:36,fontWeight:800,fontFamily:font,color:classifyZ(results.fv.zFon).color}}>{results.fv.phonologic}</div>
                <div style={{fontSize:13,fontFamily:font}}>Z={results.fv.zFon>0?"+":""}{results.fv.zFon}</div>
                <span style={S.badge(classifyZ(results.fv.zFon).color)}>{classifyZ(results.fv.zFon).label}</span>
              </div>
            )}
          </div>
        </div>
      )}
      {results.wais&&<WAISResults r={results.wais}/>}
      {results.stroop&&<StroopResults r={results.stroop}/>}
      {results.ravlt&&<RAVLTResults r={results.ravlt}/>}
      {results.tavec&&<TAVECResults r={results.tavec}/>}
      {results.wms3&&<WMS3Results r={results.wms3}/>}
      {results.wcst&&<WCSTResults r={results.wcst}/>}
      {results.ifs&&(
        <div style={S.card}>
          <h3 style={S.sectionTitle}>🧠 IFS — INECO Frontal Screening</h3>
          <div style={{display:"flex",gap:20,flexWrap:"wrap",marginBottom:16}}>
            <div style={{...S.indexBox,border:`2px solid ${results.ifs.below?C.danger:C.success}40`}}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>TOTAL IFS</div>
              <div style={{fontSize:44,fontWeight:800,fontFamily:font,color:results.ifs.below?C.danger:C.success}}>{results.ifs.total.toFixed(1)}/30</div>
              <span style={S.badge(results.ifs.below?C.danger:C.success)}>{results.ifs.below?"⚠ Bajo punto de corte":"✅ Normal (≥ 25)"}</span>
            </div>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>ÍND. MEM. TRABAJO</div>
              <div style={{fontSize:36,fontWeight:800,fontFamily:font,color:C.primary}}>{results.ifs.wm}/10</div>
              <div style={{fontSize:11,color:C.textLight,fontFamily:font}}>Dígitos + Corsi</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {IFS_SUBTESTS.map(st=>{
              const v=parseFloat(results.ifs.scores[st.key]);
              const pct=(v/st.max)*100;
              return(
                <div key={st.key} style={{...S.indexBox,padding:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.textLight,fontFamily:font,marginBottom:4}}>{st.label.split("(")[0].trim()}</div>
                  <div style={{fontSize:22,fontWeight:800,fontFamily:font,color:C.primary}}>{isNaN(v)?"—":v}/{st.max}</div>
                  <div style={{height:5,background:C.border,borderRadius:3,marginTop:6,overflow:"hidden"}}><div style={{width:`${pct||0}%`,height:"100%",background:C.primary,borderRadius:3}}/></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {results.mbi&&(
        <div style={S.card}><h3 style={S.sectionTitle}>🔥 MBI</h3>
          <div style={{background:results.mbi.burnout?`${C.danger}15`:`${C.success}15`,border:`2px solid ${results.mbi.burnout?C.danger:C.success}40`,borderRadius:10,padding:"14px 18px",marginBottom:16}}>
            <span style={{fontWeight:700,fontFamily:font,color:results.mbi.burnout?C.danger:C.success}}>{results.mbi.burnout?"⚠ Indicadores de Burnout":"✅ Sin indicadores de Burnout"}</span>
          </div>
          <div style={S.grid3}>
            {[{sub:"AE",sum:results.mbi.sumAE,max:54,cls:results.mbi.clsAE},{sub:"D",sum:results.mbi.sumD,max:30,cls:results.mbi.clsD},{sub:"RP",sum:results.mbi.sumRP,max:48,cls:results.mbi.clsRP}].map(s=>(
              <div key={s.sub} style={S.indexBox}>
                <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>{s.sub}</div>
                <div style={{fontSize:32,fontWeight:800,fontFamily:font,color:s.cls?s.cls.color:C.primary}}>{s.sum}/{s.max}</div>
                <span style={S.badge(s.cls?s.cls.color:C.textLight)}>{s.cls?s.cls.level:"—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {results.bads&&(
        <div style={S.card}>
          <h3 style={S.sectionTitle}>🧪 BADS</h3>
          <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
            <div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>PERFIL TOTAL</div><div style={{fontSize:34,fontWeight:800,fontFamily:font,color:classifyZ(results.bads.z).color}}>{results.bads.total}/24</div></div>
            <div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>Z ARG</div><div style={{fontSize:30,fontWeight:800,fontFamily:font,color:classifyZ(results.bads.z).color}}>{results.bads.z>0?"+":""}{results.bads.z}</div><span style={S.badge(classifyZ(results.bads.z).color)}>{results.bads.label}</span></div>
          </div>
          <ClinicalInterpBlock testId="bads" results={results} patient={patient} source="Farías Sarquís et al. (2021). Normas argentinas BADS. | Wilson et al. (1996). BADS. Thames Valley Test."/>
        </div>
      )}
      {results.rey&&(
        <div style={S.card}>
          <h3 style={S.sectionTitle}>🔷 Figura Compleja de Rey</h3>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
            {results.rey.copia!==null&&<div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>COPIA</div><div style={{fontSize:28,fontWeight:800,fontFamily:font,color:C.primary}}>{results.rey.copia}/36</div><div style={{fontFamily:font,fontSize:12}}>P{results.rey.copiaPC}</div></div>}
            {results.rey.memoria!==null&&<div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>MEMORIA</div><div style={{fontSize:28,fontWeight:800,fontFamily:font,color:C.primary}}>{results.rey.memoria}/36</div><div style={{fontFamily:font,fontSize:12}}>P{results.rey.memoriaPC}</div></div>}
            {results.rey.retencion!==null&&<div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>RETENCIÓN</div><div style={{fontSize:28,fontWeight:800,fontFamily:font,color:results.rey.retencion>=75?C.success:results.rey.retencion>=50?C.warning:C.danger}}>{results.rey.retencion}%</div></div>}
            {results.rey.tipo&&<div style={{fontFamily:font,fontSize:13}}>Tipo {results.rey.tipo}</div>}
          </div>
        </div>
      )}
      {results.snap&&(
        <div style={S.card}>
          <h3 style={S.sectionTitle}>⚡ SNAP-IV</h3>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
            {[{l:"DA",v:results.snap.sumDA,m:results.snap.meanDA,p:results.snap.daPos},{l:"HI",v:results.snap.sumHI,m:results.snap.meanHI,p:results.snap.hiPos},{l:"ODD",v:results.snap.sumODD,m:null,p:results.snap.sumODD>=6}].map(s=>(
              <div key={s.l} style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>{s.l}</div><div style={{fontSize:26,fontWeight:800,fontFamily:font,color:s.p?C.danger:C.success}}>{s.v}</div>{s.m!==null&&<div style={{fontFamily:font,fontSize:11}}>M={s.m}</div>}<span style={S.badge(s.p?C.danger:C.success)}>{s.p?"Positivo":"Negativo"}</span></div>
            ))}
            <div style={{fontFamily:font,fontSize:14,fontWeight:700,color:results.snap.daPos||results.snap.hiPos?C.danger:C.success}}>{results.snap.subtype}</div>
          </div>
        </div>
      )}
      {results.papdi&&(
        <div style={S.card}>
          <h3 style={S.sectionTitle}>🖼 PAPDI</h3>
          <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
            <div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>SCORE</div><div style={{fontSize:34,fontWeight:800,fontFamily:font,color:C.primary}}>{results.papdi.score}/30</div></div>
            {results.papdi.z!==null&&<div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>Z</div><div style={{fontSize:28,fontWeight:800,fontFamily:font,color:classifyZ(results.papdi.z).color}}>{results.papdi.z>0?"+":""}{results.papdi.z}</div><span style={S.badge(classifyZ(results.papdi.z).color)}>{results.papdi.label}</span></div>}
          </div>
        </div>
      )}
      {results.bnt&&(
        <div style={S.card}>
          <h3 style={S.sectionTitle}>🏷 BNT-{results.bnt.mode}</h3>
          <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
            <div style={S.indexBox}><div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>SCORE</div><div style={{fontSize:34,fontWeight:800,fontFamily:font,color:C.primary}}>{results.bnt.score}/{results.bnt.mode==="60"?60:12}</div></div>
            <div style={{fontFamily:font,fontSize:14,fontWeight:700}}>{results.bnt.label}</div>
          </div>
        </div>
      )}
      {results.scl90&&(
        <div style={S.card}>
          <h3 style={S.sectionTitle}>📋 SCL-90-R</h3>
          {results.scl90.igsCls&&(
            <div style={{background:`${results.scl90.igsCls.color}12`,border:`2px solid ${results.scl90.igsCls.color}40`,borderRadius:12,padding:12,marginBottom:14,display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
              <div style={S.indexBox}>
                <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>IGS T-SCORE</div>
                <div style={{fontSize:34,fontWeight:800,fontFamily:font,color:results.scl90.igsCls.color}}>{results.scl90.igsT}</div>
                <span style={S.badge(results.scl90.igsCls.color)}>{results.scl90.igsCls.label}</span>
              </div>
              <div style={{fontFamily:font,fontSize:12,color:C.textLight}}>
                IGS bruto={results.scl90.IGS.toFixed(3)} · PST={results.scl90.PST}/90 · PSDI={results.scl90.PSDI?.toFixed(3)}
              </div>
            </div>
          )}
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {Object.entries(SCL90_DIMS).map(([dk,dd])=>{
              const r=results.scl90.dims[dk];
              return r?(
                <div key={dk} style={{...S.indexBox,minWidth:110}}>
                  <div style={{fontSize:10,fontWeight:700,color:dd.color,fontFamily:font}}>{dd.label}</div>
                  <div style={{fontSize:22,fontWeight:800,fontFamily:font,color:r&&r.cls?r.cls.color:C.primary}}>T={r.t}</div>
                  <span style={S.badge(r&&r.cls?r.cls.color:C.textLight)}>{r&&r.cls?r.cls.label:"—"}</span>
                </div>
              ):null;
            })}
          </div>
        </div>
      )}
      {results.srs&&(
        <div style={S.card}>
          <h3 style={S.sectionTitle}>🔵 SRS</h3>
          <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>BRUTO</div>
              <div style={{fontSize:34,fontWeight:800,fontFamily:font,color:results.srs.cls?results.srs.cls.color:C.textLight}}>{results.srs.raw}</div>
            </div>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>T-SCORE</div>
              <div style={{fontSize:38,fontWeight:800,fontFamily:font,color:results.srs.cls?results.srs.cls.color:C.textLight}}>{results.srs.t}</div>
              <span style={S.badge(results.srs.cls?results.srs.cls.color:C.textLight)}>{results.srs.cls?results.srs.cls.label:"—"}</span>
            </div>
            <div style={{flex:1,fontFamily:font,fontSize:13}}>
              <div style={{fontWeight:700,color:results.srs.cls?results.srs.cls.color:C.textLight,marginBottom:4}}>{results.srs.cls?results.srs.cls.desc:""}</div>
              <div style={{color:C.textLight}}>Informante: {results.srs.informant==="parent"?"Padre/Madre":"Docente"} · Sexo: {results.srs.sex==="M"?"Masculino":"Femenino"}</div>
            </div>
          </div>
        </div>
      )}
      {results.wisc5&&(
        <div style={S.card}>
          <h3 style={S.sectionTitle}>🧩 WISC-V</h3>
          {/* CIT destacado */}
          {results.wisc5.indexes.CIT&&(
            <div style={{background:`${results.wisc5.indexes.CIT&&results.wisc5.indexes.CIT.cls?results.wisc5.indexes.CIT.cls.color:C.primary}12`,border:`2px solid ${results.wisc5.indexes.CIT&&results.wisc5.indexes.CIT.cls?results.wisc5.indexes.CIT.cls.color:C.primary}40`,borderRadius:12,padding:14,marginBottom:16,display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
              <div style={S.indexBox}>
                <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>CIT — ESCALA TOTAL</div>
                <div style={{fontSize:44,fontWeight:800,fontFamily:font,color:results.wisc5.indexes.CIT&&results.wisc5.indexes.CIT.cls?results.wisc5.indexes.CIT.cls.color:C.primary}}>{results.wisc5.indexes.CIT.val}</div>
                <span style={S.badge(results.wisc5.indexes.CIT&&results.wisc5.indexes.CIT.cls?results.wisc5.indexes.CIT.cls.color:C.primary)}>{results.wisc5.indexes.CIT.cls.label}</span>
              </div>
              <div style={{fontFamily:font,fontSize:13}}>
                <div>Percentil: {results.wisc5.indexes.CIT.pct}</div>
                {results.wisc5.indexes.CIT.ci&&<div>IC 95%: {results.wisc5.indexes.CIT.ci.lo}–{results.wisc5.indexes.CIT.ci.hi}</div>}
                <div style={{color:C.textLight,fontSize:11,marginTop:4}}>{results.wisc5.indexes.CIT.cls.range}</div>
              </div>
            </div>
          )}
          {/* Índices principales */}
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:12}}>
            {WISC5_INDEXES.filter(i=>i.type==="principal"&&i.key!=="CIT").map(i=>{
              const r=results.wisc5.indexes[i.key];
              if(!r) return null;
              return(
                <div key={i.key} style={S.indexBox}>
                  <div style={{fontSize:10,fontWeight:700,color:C.textLight,fontFamily:font}}>{i.abbr}</div>
                  <div style={{fontSize:26,fontWeight:800,fontFamily:font,color:r&&r.cls?r.cls.color:C.primary}}>{r.val}</div>
                  <div style={{fontSize:11,fontFamily:font}}>P{r.pct}</div>
                  <span style={S.badge(r&&r.cls?r.cls.color:C.textLight)}>{r&&r.cls?r.cls.label:"—"}</span>
                </div>
              );
            })}
          </div>
          {/* Perfil escalares */}
          {Object.keys(results.wisc5.subtests).length>0&&(
            <div>
              <div style={{fontFamily:font,fontSize:12,fontWeight:700,color:C.textMid,marginBottom:8}}>Perfil de subpruebas</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {WISC5_SUBTESTS.map(s=>{
                  const v=results.wisc5.subtests[s.key];
                  if(v===undefined) return null;
                  const z=(v-10)/3;
                  const cls=classifyZ(z);
                  return(
                    <div key={s.key} style={{...S.indexBox,minWidth:70,padding:8}}>
                      <div style={{fontSize:10,fontWeight:700,color:C.textLight,fontFamily:font}}>{s.abbr}</div>
                      <div style={{fontSize:22,fontWeight:800,fontFamily:font,color:cls?cls.color:C.textLight}}>{v}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
      {results.caras&&(
        <div style={S.card}>
          <h3 style={S.sectionTitle}>👁 CARAS-R</h3>
          <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>A-E (PRINCIPAL)</div>
              <div style={{fontSize:34,fontWeight:800,fontFamily:font,color:results.caras.cls?results.caras.cls.color:C.textLight}}>{results.caras.AE}</div>
              <div style={{fontSize:13,fontFamily:font}}>Z={results.caras.zAE>0?"+":""}{results.caras.zAE}</div>
              <span style={S.badge(results.caras.cls?results.caras.cls.color:C.textLight)}>{results.caras.cls?results.caras.cls.label:"—"}</span>
            </div>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>ENEATIPO</div>
              <div style={{fontSize:36,fontWeight:800,fontFamily:font,color:results.caras.eneatipo>=7?C.success:results.caras.eneatipo>=4?C.warning:C.danger}}>{results.caras.eneatipo}</div>
            </div>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>ICI</div>
              <div style={{fontSize:28,fontWeight:800,fontFamily:font,color:C.primary}}>{results.caras.ICI}%</div>
            </div>
            <div style={{fontFamily:font,fontSize:13,flex:1}}>
              <div>Grado: {CARAS_NORMS[results.caras.grade]?.label} · {CARAS_NORMS[results.caras.grade]?.age} años</div>
              <div>A={results.caras.A} · E={results.caras.E} · A-E={results.caras.AE}</div>
            </div>
          </div>
        </div>
      )}
      {results.d2&&(
        <div style={S.card}>
          <h3 style={S.sectionTitle}>🎯 d2 — Test de Atención</h3>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            {[
              {label:"TR",val:results.d2.TR,z:null},
              {label:"TA",val:results.d2.TA,z:results.d2.zTA},
              {label:"CON",val:results.d2.CON,z:results.d2.zCON},
              {label:"O ERR",val:results.d2.O,z:results.d2.zO},
              {label:"E%",val:results.d2.Epct!=null?results.d2.Epct+"%":null,z:null},
            ].filter(s=>s.val!==null&&s.val!==undefined).map(s=>{
              const cls=classifyZ(s.z);
              return(
                <div key={s.label} style={{...S.indexBox,minWidth:100}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.textLight,fontFamily:font}}>{s.label}</div>
                  <div style={{fontSize:24,fontWeight:800,fontFamily:font,color:cls?cls.color:C.primary}}>{s.val}</div>
                  {cls&&<><div style={{fontSize:12,fontFamily:font}}>Z={s.z>0?"+":""}{s.z}</div><span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span></>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {results.neuropsi&&(
        <div style={S.card}>
          <h3 style={S.sectionTitle}>🔬 NEUROPSI</h3>
          <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
            <div style={{...S.indexBox,border:`2px solid ${C.primary}30`}}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>TOTAL</div>
              <div style={{fontSize:34,fontWeight:800,fontFamily:font,color:C.primary}}>{results.neuropsi.total}/122</div>
              <div style={{fontSize:12,fontFamily:font}}>{Math.round(results.neuropsi.total/1.22)}%</div>
            </div>
            {Object.entries(results.neuropsi.domains).map(([dom,{tot,max}])=>{
              const pct=max>0?Math.round(tot/max*100):0;
              const color=pct>=80?C.success:pct>=60?C.warning:C.danger;
              const info=NEUROPSI_DOMAINS[dom];
              return(
                <div key={dom} style={{...S.indexBox,minWidth:110}}>
                  <div style={{fontSize:10,fontWeight:700,color:info.color,fontFamily:font}}>{dom==="FE"?"F. Ejecutivas":dom==="Motoras"?"F. Motoras":dom}</div>
                  <div style={{fontSize:22,fontWeight:800,fontFamily:font,color}}>{tot}/{max}</div>
                  <div style={{height:4,background:C.border,borderRadius:2,marginTop:4,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:info.color,borderRadius:2}}/></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {results.wurs&&(
        <div style={S.card}>
          <h3 style={S.sectionTitle}>🔎 WURS-{results.wurs.mode}</h3>
          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>PUNTAJE</div>
              <div style={{fontSize:38,fontWeight:800,fontFamily:font,color:results.wurs.cutScandar?C.danger:C.success}}>{results.wurs.score25}</div>
            </div>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>PERCENTIL ARG</div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:font,color:C.primary}}>P{results.wurs.pct25}</div>
            </div>
            <div style={S.indexBox}>
              <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>Z (pob. general)</div>
              <div style={{fontSize:32,fontWeight:800,fontFamily:font,color:results.wurs.z25>1.2?C.danger:C.success}}>{results.wurs.z25>0?"+":""}{results.wurs.z25}</div>
            </div>
            <div style={{flex:1}}>
              <div style={{fontFamily:font,fontSize:13,marginBottom:4}}><strong>Corte Scandar (esp. 90%):</strong> <span style={{color:results.wurs.cutScandar?C.danger:C.success,fontWeight:700}}>{results.wurs.cutScandar?"≥36.5 ✓ Sugestivo TDAH":"No supera corte"}</span></div>
              <div style={{fontFamily:font,fontSize:13}}><strong>Corte Ward (1993):</strong> <span style={{color:results.wurs.cutWard?C.danger:C.textLight,fontWeight:700}}>{results.wurs.cutWard?"≥46 ✓":"Negativo"}</span></div>
            </div>
          </div>
        </div>
      )}
      {results.asrs&&(
        <div style={S.card}>
          <h3 style={S.sectionTitle}>📋 ASRS v1.1</h3>
          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
            {[{label:"TOTAL",val:results.asrs.scoreT,max:72,pct:results.asrs.pctT,z:results.asrs.zT},{label:"INATENCIÓN",val:results.asrs.scoreI,max:36,pct:results.asrs.pctI,z:results.asrs.zI},{label:"HIPERACTIVIDAD",val:results.asrs.scoreH,max:36,pct:results.asrs.pctH,z:results.asrs.zH}].map(s=>(
              <div key={s.label} style={S.indexBox}>
                <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>{s.label}</div>
                <div style={{fontSize:28,fontWeight:800,fontFamily:font,color:s.pct>=75?C.danger:C.success}}>{s.val}/{s.max}</div>
                <div style={{fontSize:12,fontFamily:font}}>P{s.pct} · Z={s.z>0?"+":""}{s.z}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {results.reloj&&(
        <div style={S.card}>
          <h3 style={S.sectionTitle}>🕐 Test del Reloj</h3>
          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
            {[{label:"TRO (orden)",val:results.reloj.tro,max:10,cut:6,danger:results.reloj.tro<=6},{label:"TRC (copia)",val:results.reloj.trc,max:10,cut:8,danger:results.reloj.trc<=8},{label:"TRO+TRC",val:results.reloj.total,max:20,cut:15,danger:results.reloj.total<=15}].filter(s=>s.val!==null).map(s=>(
              <div key={s.label} style={S.indexBox}>
                <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>{s.label}</div>
                <div style={{fontSize:28,fontWeight:800,fontFamily:font,color:s.danger?C.danger:C.success}}>{s.val}/{s.max}</div>
                <span style={S.badge(s.danger?C.danger:C.success)}>{s.danger?"⚠ Positivo":"✅ Normal"}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {results.hotel&&results.hotel.norm&&(
        <div style={S.card}>
          <h3 style={S.sectionTitle}>🏨 Test del Hotel</h3>
          <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
            {[
              {label:"Tareas realizadas",val:results.hotel.data.tareas,normM:results.hotel.norm.tareasM,normSD:results.hotel.norm.tareasSD,inv:false},
              {label:"Desvío tiempo (s)",val:results.hotel.data.tiempoDesvio,normM:results.hotel.norm.tiempoM,normSD:results.hotel.norm.tiempoSD,inv:true},
              {label:"Desvío botones (s)",val:results.hotel.data.botonesDesvio,normM:results.hotel.norm.botonesM,normSD:results.hotel.norm.botonesSD,inv:true},
            ].filter(s=>s.val).map(s=>{
              const z=parseFloat(((parseFloat(s.val)-s.normM)/s.normSD).toFixed(2));
              const cls=classifyZ(s.inv?-z:z);
              return(
                <div key={s.label} style={S.indexBox}>
                  <div style={{fontSize:11,fontWeight:700,color:C.textLight,fontFamily:font}}>{s.label}</div>
                  <div style={{fontSize:28,fontWeight:800,fontFamily:font,color:cls?cls.color:C.textLight}}>{s.val}</div>
                  <div style={{fontSize:12,fontFamily:font}}>Z={z>0?"+":""}{z}</div>
                  <span style={S.badge(cls?cls.color:C.textLight)}>{cls?cls.label:"—"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <AIReportGenerator results={results} patient={patient}/>

      {/* ── ANEXO PROTOCOLO ──────────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div>
            <h3 style={S.sectionTitle}>📊 Anexo — Protocolo de Valoración Cognitiva</h3>
            <p style={{fontFamily:font,fontSize:12,color:C.textLight,margin:0}}>Tabla de puntajes Z con escala visual. Imprimí o copiá al expediente.</p>
          </div>
          <button onClick={()=>{
            const el=document.getElementById("anexo-print-area");
            if(!el) return;
            const w=window.open("","_blank","width=900,height=700");
            w.document.write(`<html><head><title>Protocolo de Valoración Cognitiva</title>
              <style>
                body{font-family:Arial,sans-serif;padding:20px;font-size:11px;}
                table{width:100%;border-collapse:collapse;}
                th,td{padding:3px 6px;border:1px solid #ddd;}
                th{background:#333;color:white;}
                .sec-hdr{background:#e8e8e8;font-weight:bold;border-top:2px solid #aaa;}
                .col-zero{border-left:2px solid #999!important;}
                .col-neg{background:#fff0f0;}
                .col-pos{background:#f0fff0;}
                .col-z{background:#f5f5f5;}
                @media print{button{display:none!important;}}
              </style>
            </head><body>
              <button onclick="window.print()" style="margin-bottom:12px;padding:6px 14px;cursor:pointer;">🖨 Imprimir</button>
              ${el.innerHTML}
            </body></html>`);
            w.document.close();
          }} style={{padding:"8px 16px",borderRadius:8,background:C.primary,color:"white",border:"none",fontFamily:font,fontWeight:700,cursor:"pointer",fontSize:13}}>
            🖨 Imprimir / PDF
          </button>
        </div>
        <AnexoTable results={results} patient={patient} adminTests={adminTests}/>
      </div>
    </div>
  );
}

// ── Mount ─────────────────────────────────────────────
(function mount(){
  const el = document.getElementById('root');
  if(!el) return;
  const root = ReactDOM.createRoot(el);
  root.render(React.createElement(App));
  // Ocultar loader
  const loader = document.getElementById('loader');
  if(loader){
    const fill = document.getElementById('loader-fill');
    const txt  = document.getElementById('loader-text');
    if(fill) fill.style.width = '100%';
    if(txt)  txt.textContent  = '';
    setTimeout(function(){ loader.classList.add('hidden'); }, 300);
    setTimeout(function(){ loader.style.display = 'none'; }, 900);
  }
  // Mostrar panel de API key si hace falta
  const key = localStorage.getItem('npsych_apikey') || '';
  if(!key || !key.startsWith('sk-ant-')){
    showApiKeyPanel();
  }
})();
