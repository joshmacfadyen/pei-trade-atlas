import pandas as pd, sys, json, re
f=sys.argv[1]; out=sys.argv[2]
im=pd.read_excel(f,'Imports',dtype={'Commodity_Category':str}); ex=pd.read_excel(f,'Exports',dtype={'Commodity_Category':str})
s=pd.read_excel(f,'SITC 4',header=1,dtype=str)
ref=dict(zip(s.ProductCode.str.strip(),s.ProductDescription.str.strip()))

PORT={'Murray Harbor':'Murray Harbour','Cascumpeque':'Cascumpec','St. Peters':"St. Peter's",'Pinnette':'Pinette','Colville  Bay':'Colville Bay'}
CTRY={'St Pierre':'Saint-Pierre & Miquelon','Saint Pierre (Miquelon)':'Saint-Pierre & Miquelon','Saint Pierre and Miquelon':'Saint-Pierre & Miquelon',
      'Foreign W. Indies':'West Indies'}
def sitc_code(value):
    """SITC code for an entry, read from its own Commodity_Category cell and checked against the SITC 4 sheet.
    Returns (code or None, reason). Codes are kept as text so leading zeros survive (0452 = oats)."""
    if value is None or (isinstance(value,float) and pd.isna(value)): return None, 'Commodity_Category is empty: unclassified'
    c=str(value).strip()
    if c.endswith('.0'): c=c[:-2]            # a code typed as a number
    if c in ref: return c, f'Commodity_Category {c} = SITC 4 "{ref[c]}"'
    if c.isdigit():                           # a number that lost its leading zeros
        for k in range(1,6-len(c)):
            z='0'*k+c
            if z in ref: return z, f'Commodity_Category {c} is not in SITC 4 as written; read as {z} ("{ref[z]}")'
    return None, f'Commodity_Category "{c}" is not in SITC 4: unclassified'

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
    code,how=sitc_code(r.Commodity_Category)
    rows.append(dict(d='Imports',y=int(r.Year),c=r.Cleaned_Country_Names if pd.notna(r.Cleaned_Country_Names) else rawc(r.Country),
        p=PORT.get(r.harbour_name,r.harbour_name),a=str(r.Article).strip(),code=code,how=how,v=float(v),
        xr=i+2,ra=txt(r.Article),rc=txt(r.Country),rh=txt(r.harbour_name),pv=txt(r['Value_Of_Total_Imports']),wv=float(r['Value (£)']),
        pg=txt(r.Page),src=txt(r.Source),qty=txt(r.Total)))
for i,r in ex.iterrows():
    v=r['Value()']
    if pd.isna(v) or v<=0: continue
    rows.append(dict(d='Exports',y=int(r.Year),c=r.Cleaned_Country_Names,p=PORT.get(r.Cleaned_port_names,r.Cleaned_port_names),
        a=str(r.Articles).strip(),code=sitc_code(r.Commodity_Category)[0],how=sitc_code(r.Commodity_Category)[1],v=float(v),
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
print('blank Value (£) filled from printed £sd:',len(BLANK)); print('unclassified entries:',sorted(set(f'{a} ({h})' for a,c,h in zip(df.a,df.code,df.how) if not isinstance(c,str)))[:20]); print('fixed',len(FIXED),'adds £',round(sum(q-v for *_,v,q in FIXED),2))
