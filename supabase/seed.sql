insert into responders(code,name,review_due) values ('R-01','Aroha Demo',current_date+90),('R-02','Tama Demo',current_date-3),('R-03','Sam Demo',current_date+90),('R-04','Sam Demo Backup',current_date+90) on conflict(code) do nothing;
insert into policies(code,name,owner,levels,review_due) values ('P-01','Storefront','Aroha',2,current_date+30),('P-02','Data delivery','Tama',2,current_date-2) on conflict(code) do nothing;
insert into services(code,name,policy_id) select 'S-01','Demo orders',id from policies where code='P-01' on conflict(code) do nothing;
insert into services(code,name,policy_id) select 'S-02','Demo reports',id from policies where code='P-02' on conflict(code) do nothing;
insert into slots(code,policy_id,responder_id,level,starts_at,ends_at,verified,evidence)
select x.code,p.id,r.id,x.level,current_date+x.a*interval '1 hour',current_date+x.b*interval '1 hour',x.verified,'Synthetic demo assignment' from (values
 ('SHIFT-01','P-01','R-01',1,0,24,true),('SHIFT-02','P-01','R-02',1,26,48,true),('SHIFT-03','P-01','R-03',2,0,48,true),('SHIFT-04','P-02','R-01',1,12,36,true),('SHIFT-05','P-02','R-04',2,0,24,false)
) x(code,p,r,level,a,b,verified) join policies p on p.code=x.p join responders r on r.code=x.r on conflict(code) do nothing;
insert into handovers(code,policy_id,name,owner,due_at) select 'H-01',id,'Check the overnight batch notes','Tama',now()-interval '3 hours' from policies where code='P-02' on conflict(code) do nothing;
insert into actions(code,name,owner,due_on) values('A-01','Find cover for the two-hour Storefront gap','Aroha',current_date-1) on conflict(code) do nothing;
