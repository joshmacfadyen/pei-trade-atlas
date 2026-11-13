import pandas as pd, sys, json, re
f=sys.argv[1]; out=sys.argv[2]
im=pd.read_excel(f,'Imports',dtype={'Commodity_Category':str}); ex=pd.read_excel(f,'Exports')
s=pd.read_excel(f,'SITC 4',header=1,dtype=str)
ref=dict(zip(s.ProductCode.str.strip(),s.ProductDescription.str.strip()))
e=pd.read_excel(f,'Entry',header=None,dtype=str)
amap={a.strip():c.split(' - ')[0].strip() for a,c in e.iloc[2:,[14,15]].dropna().values}

PORT={'Murray Harbor':'Murray Harbour','Cascumpeque':'Cascumpec','St. Peters':"St. Peter's",'Pinnette':'Pinette','Colville  Bay':'Colville Bay'}
CTRY={'St Pierre':'Saint-Pierre & Miquelon','Saint Pierre (Miquelon)':'Saint-Pierre & Miquelon','Saint Pierre and Miquelon':'Saint-Pierre & Miquelon',
      'Foreign W. Indies':'West Indies'}
# ambiguous export codes (integer codes lost leading zeros): pick by article meaning
EXOVR={('Potatoes','541'):'0541',('Eggs','251'):'0251',('Tea','741'):'0741',('Coffee','7111'):'07111',
 ('Tobacco','1212'):'1212',('Flaxseed','2231'):'2231',('Fish (Salmon & Lobsters)','3'):'03'}
def ex_code(a,c):
    c=str(int(c)); a=a.strip()
    if (a,c) in EXOVR: return EXOVR[(a,c)]
    if a.startswith('Oil'): return '4'
    cands=[('0'*k)+c for k in range(0,6-len(c)) if ('0'*k)+c in ref]
    if len(cands)==1: return cands[0]
    al=a.lower()
    if any(w in al for w in ['pork','mutton','sheep','calves','animal']):
        # meat / live animals: section 0 reading
        z=[x for x in cands if x.startswith('0')]
        live=[x for x in z if x.startswith('00')]
        if ('sheep' in al or 'calves' in al or 'animal' in al) and live: return live[0]
        return z[0]
    z=[x for x in cands if x.startswith('0')]
    if z: return z[0]   # fewest restored zeros: the food reading
    raise Exception((a,c,cands))
FIXED=[]; BLANK=[]
def lsd(x):
    if x is None or (isinstance(x,float) and pd.isna(x)): return None
    if isinstance(x,(int,float)): return float(x)
    t=str(x).replace('£','').replace(',','').strip(); half=0
    for fr,val in (('1/2',.5),('1/4',.25),('3/4',.75)):
        if fr in t: half=val; t=t.replace(fr,'')
    n=[int(y) for y in re.findall(r'\d+',t)]
    if not n: return None
    while len(n)<3: n.append(0)
    return n[0]+n[1]/20+(n[2]+half)/240
def rawc(x):
    # Cleaned_Country_Names left blank: fall back to the recorded country, tidied
    if x is None or (isinstance(x,float) and pd.isna(x)): return 'Country raw: nan'
    s=re.sub(r'\s+',' ',str(x)).strip().rstrip('.,;: ')
    if re.search(r'british north american',s,re.I): return 'Country raw: British North American Colonies.'
    return s
rows=[]
def txt(x):
    if x is None or (isinstance(x,float) and pd.isna(x)): return ''
    if isinstance(x,float) and x.is_integer(): x=int(x)
    return str(x).strip()
for i,r in im.iterrows():
    v=r['Value (£)']
    q=lsd(r['Value_Of_Total_Imports'])
    if (pd.isna(v) or v==0) and q and not re.search(r'total|carried|brought|amount of|header',str(r.Article),re.I) and pd.notna(r.Article):
        BLANK.append((r.Article,r.harbour_name,int(r.Year))); v=q   # Value (£) left blank: use the printed £ s d
    if pd.isna(v) or v<=0: continue
    if q is not None and abs(q-v)>0.01: FIXED.append((r.Article,r.harbour_name,int(r.Year),r['Value_Of_Total_Imports'],v,q)); v=q   # formula dropped the pounds
    code=amap.get(str(r.Article).strip())
    rows.append(dict(d='Imports',y=int(r.Year),c=r.Cleaned_Country_Names if pd.notna(r.Cleaned_Country_Names) else rawc(r.Country),
        p=PORT.get(r.harbour_name,r.harbour_name),a=str(r.Article).strip(),code=code,v=float(v),
        xr=i+2,ra=txt(r.Article),rc=txt(r.Country),rh=txt(r.harbour_name),pv=txt(r['Value_Of_Total_Imports']),wv=float(r['Value (£)']),
        pg=txt(r.Page),src=txt(r.Source),qty=txt(r.Total)))
for i,r in ex.iterrows():
    v=r['Value()']
    if pd.isna(v) or v<=0: continue
    rows.append(dict(d='Exports',y=int(r.Year),c=r.Cleaned_Country_Names,p=PORT.get(r.Cleaned_port_names,r.Cleaned_port_names),
        a=str(r.Articles).strip(),code=ex_code(r.Articles,r.Commodity_Category),v=float(v),
        xr=i+2,ra=txt(r.Articles),rc=txt(r.Country),rh=txt(r.Port),pv=txt(r.Value_of_Total_Exports),wv=float(r['Value()']),
        pg=txt(r.Page),src=txt(r.Source) if 'Source' in ex.columns else '',qty=' / '.join(x for x in [txt(r.total_PMC),txt(r.total_NonPMC)] if x)))
df=pd.DataFrame(rows)
df['c']=df.c.replace(CTRY)
df['code']=df.code.replace({'None':None})
df['sec']=df.code.str[0]; df['div']=df.code.where(df.code.str.len()>=2).str[:2]
pd.set_option('display.width',200)
for d,g in df.groupby('d'):
    print('=====',d, 'rows',len(g),'total £',round(g.v.sum()))
    print(g.groupby('c').v.sum().sort_values(ascending=False).round().to_string())
    print(g.groupby('p').v.sum().sort_values(ascending=False).round().to_string())
    print(g.groupby('sec',dropna=False).v.sum().round().to_string())
    print(g.groupby('y').v.sum().round().to_string())
df.to_pickle(out)
import json as _j; _j.dump([list(map(str,x)) for x in FIXED],open('fixed_values.json','w'),indent=1)
print('blank Value (£) filled from printed £sd:',len(BLANK)); print('unmapped SITC articles:',sorted(set(a for a,c in zip(df.a,df.code) if c is None and isinstance(a,str)))[:20]); print('fixed',len(FIXED),'adds £',round(sum(q-v for *_,v,q in FIXED),2))
