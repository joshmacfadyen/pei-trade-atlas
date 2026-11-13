import pandas as pd, json, re, sys
f=sys.argv[1]
df=pd.read_pickle('rows.pkl')
s=pd.read_excel(f,'SITC 4',header=1,dtype=str)
ref=dict(zip(s.ProductCode.str.strip(),s.ProductDescription.str.strip()))
df['c']=df.c.replace({'Country raw: British North American Colonies.':'British N. American colonies (unspecified)','Country raw: nan':'Origin not recorded'})
PLACES={ # representative port for each recorded country/colony
 'Nova Scotia':(-63.57,44.65,'Halifax'),'New Brunswick':(-66.06,45.27,'Saint John'),'United States':(-71.06,42.36,'Boston'),
 'United Kingdom':(-2.99,53.41,'Liverpool'),'Canada':(-71.21,46.81,'Quebec'),'Newfoundland':(-52.71,47.56,"St. John's"),
 'Saint-Pierre & Miquelon':(-56.18,46.78,'Saint-Pierre'),'Magdalen Islands':(-61.85,47.38,'Havre Aubert'),
 'Bermuda':(-64.78,32.29,'Hamilton'),'West Indies':(-66.0,18.0,'Caribbean'),'France':(-2.0,48.65,'Saint-Malo'),
 'British N. American colonies (unspecified)':(None,None,None),'Origin not recorded':(None,None,None)}
PORTS={'Charlottetown':(-63.126,46.235),'Georgetown':(-62.533,46.183),'Bedeque':(-63.785,46.385),'Colville Bay':(-62.25,46.36),
 'Murray Harbour':(-62.52,46.0),'Malpeque':(-63.68,46.54),'Cascumpec':(-64.05,46.77),'New London':(-63.5,46.49),'Crapaud':(-63.49,46.24),
 'Grand River':(-63.87,46.5),'Orwell Bay':(-62.86,46.13),'Rustico':(-63.27,46.46),'Pinette':(-62.89,46.03),"St. Peter's":(-62.58,46.43),'Tignish':(-64.03,46.95)}
CATS=[('0','Food & live animals'),('1','Beverages & tobacco'),('2','Crude materials'),('3','Mineral fuels'),
      ('6','Manufactured goods'),('8','Misc. manufactured articles'),('X','Other')]
CATDESC=['SITC 0 · grain, flour, fish, sugar, molasses, tea, livestock','SITC 1 · spirits, wine, beer, tobacco',
 'SITC 2 · timber, salt, hides, seeds','SITC 3 · coal','SITC 6 · textiles, iron & steel, leather, hardware, cordage',
 'SITC 8 · clothing, footwear, books, furniture','SITC 4, 5, 7, 9 · oils & fats, soap & paint, machinery, unclassified "miscellaneous"']
sec2cat={'0':0,'1':1,'2':2,'3':3,'6':4,'8':5}
df['cat']=df.sec.map(lambda x: sec2cat.get(x,6) if isinstance(x,str) else 6)
def divkey(r):
    if not isinstance(r.code,str): return 'u'
    return r.code[:2] if len(r.code)>=2 else r.code+'*'
df['dk']=df.apply(divkey,axis=1)
divs={}
for k in df.dk.unique():
    if k=='u': divs[k]='Not classified'
    elif k.endswith('*'): divs[k]=ref[k[0]]+' (unspecified)'
    else: divs[k]=ref[k]
secs={k:ref[k] for k in '0123456789'}
def clean_art(a):
    a=re.sub(r'\s+',' ',a).strip().rstrip(',.;: ').strip()
    return a[:1].upper()+a[1:]
df['art']=df.a.map(clean_art)
# aggregate
YRS=sorted(df.y.unique()); df['yi']=df.y.map({y:i for i,y in enumerate(YRS)})
places=sorted(df.c.unique(),key=lambda c:-df[df.c==c].v.sum()); ports=sorted(df.p.unique(),key=lambda p:-df[df.p==p].v.sum())
arts=sorted(df.art.unique())
g=df.groupby(['d','yi','c','p','cat','dk','art'],as_index=False).v.sum()
rows=[[0 if r.d=='Imports' else 1,int(r.yi),places.index(r.c),ports.index(r.p),int(r.cat),r.dk,arts.index(r.art),round(float(r.v),3)] for r in g.itertuples()]
out=dict(places=[dict(name=p,lon=PLACES.get(p,(None,)*3)[0],lat=PLACES.get(p,(None,)*3)[1],rep=PLACES.get(p,(None,)*3)[2]) for p in places],
  ports=[dict(name=p,lon=PORTS.get(p,(None,None))[0],lat=PORTS.get(p,(None,None))[1]) for p in ports],
  cats=[dict(key=k,name=n,desc=d) for (k,n),d in zip(CATS,CATDESC)], divs=divs, secs=secs, arts=arts, rows=rows)
# per-entry records for the source appendix (indices align with places/ports above)
R=json.load(open('routes.json'))
if 'ports' in R:
    for h in out['ports']: h['lon0'],h['lat0']=h['lon'],h['lat']; h['lon'],h['lat']=R['ports'].get(h['name'],(h['lon'],h['lat']))
for p in out['places']:
    a=R['anchors'].get(p['name']); p['off']=bool(a); p['ax'],p['ay']=(a if a else (p['lon'],p['lat']))
out['routes']=[[R['routes'][p['name']].get(h['name']) if p['name'] in R['routes'] else None for h in out['ports']] for p in out['places']]
ent=[]
for r in df.itertuples():
    src=re.sub(r'^https?://www\.canadiana\.ca/view/','',r.src) if r.src else ''
    ent.append([0 if r.d=='Imports' else 1,int(r.yi),places.index(r.c),ports.index(r.p),int(r.cat),r.code if isinstance(r.code,str) else '',
                r.xr,r.ra,r.rc,r.rh,r.pv,round(r.wv,4),round(r.v,4),r.pg,src,r.qty,arts.index(r.art),r.dk])
out['entries']=ent
out['years']=[int(y) for y in YRS]
sitc={}
for c in df.code.dropna():
    for n in (3,4):
        if len(c)>=n: sitc[c[:n]]=ref.get(c[:n],'')
out['sitc']=sitc
import os
out['source']={'file':os.path.basename(f)}
# reconciliation against the returns' own printed all-countries totals (imports only; exports print none)
import openpyxl
wb=openpyxl.load_workbook(f,read_only=True,data_only=True); it=wb['Imports'].iter_rows(values_only=True); hdr=[str(h).strip() if h else h for h in next(it)]
PORTN={'Murray Harbor':'Murray Harbour','Cascumpeque':'Cascumpec','St. Peters':"St. Peter's",'Pinnette':'Pinette'}
def lsd(x):
    t=str(x).replace('£','').replace(',','').strip(); half=0
    for fr,val in (('1/2',.5),('1/4',.25),('3/4',.75)):
        if fr in t: half=val; t=t.replace(fr,'')
    n=[int(y) for y in re.findall(r'\d+',t)]
    if not n: return None
    while len(n)<3: n.append(0)
    return n[0]+n[1]/20+(n[2]+half)/240
printed={}
for i,row in enumerate(it):
    r=dict(zip(hdr,row)); a=str(r['Article'] or '')
    if re.search(r'total.*all countries|total value of imports',a,re.I) and not re.search(r'carried|brought',a,re.I):
        k=(int(r['Year']),PORTN.get(r['harbour_name'],r['harbour_name']))
        if k not in printed and r['Value_Of_Total_Imports'] not in (None,''):
            pv=lsd(r['Value_Of_Total_Imports'])
            if pv: printed[k]=(pv,str(r['Value_Of_Total_Imports']).strip(),i+2)
imp=df[df.d=='Imports']
out['recon']=[[y,p,round(pv,4),round(float(imp[(imp.y==y)&(imp.p==p)].v.sum()),4),raw,xr] for (y,p),(pv,raw,xr) in sorted(printed.items())]
json.dump(out,open('data.json','w'),separators=(',',':'))
print('entries',len(ent),'recon',len(out['recon']))
print(len(rows), 'rows'); import os; print(os.path.getsize('data.json'))
print(df.groupby(['d','cat']).v.sum().round())
print(sorted(divs.items()))
