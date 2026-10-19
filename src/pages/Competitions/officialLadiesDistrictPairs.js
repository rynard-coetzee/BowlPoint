// Official Ladies District Pairs draw transcribed from the secretary's provisional PDF.
// Team IDs are matched against the already-entered BowlPoint teams; no database writes occur here.
const OFFICIAL_SECTIONS = [
  { number: 1, ids: ['a3600ffb-de6e-4e91-a44b-973e7ae3d370','f43b1e8e-f67f-4de7-9a35-dac1f919538d','791cad19-469b-4a63-bfbf-81b8ca034c7d','759bfbfb-f372-46a9-829c-c736a02524de','aaccde36-3600-4e58-a3c0-26b8e20673c1','3a5ebf4b-ae8d-4b34-ae42-79659d8b0b79','c5dade59-4944-4aec-8a0e-700474af4c57'], opponents: [[2,1,4,3,6,5,8],[3,4,1,2,7,8,5],[4,3,2,1,8,7,6],[5,6,7,8,1,2,3],[6,8,5,7,3,1,4],[7,5,8,6,2,4,1],[8,7,6,5,4,3,2]] },
  { number: 2, ids: ['2419a2e9-c80a-4902-8ea2-d40521b4adda','1d826be3-0cf5-46fa-ace9-cd958ca93e06','c225fd03-5763-4985-aa13-969dfa49ccfb','bf4c54f3-16a4-4fe8-801a-4e6bedee5a06','7baaa7dd-a945-4182-b821-859a717490da','a77a2014-a95f-4a09-b10a-0f305c439d1d'], opponents: [[2,1,4,3,6,5],[3,6,1,5,4,2],[4,5,6,1,2,3],[5,3,2,6,1,4],[6,4,5,2,3,1]] },
  { number: 3, ids: ['92e33077-2cfa-4ae9-9c1f-eb19b547148b','5fb822cd-a552-4e6d-8d54-e207c482edec','5a32f8fb-073f-4d73-bf62-ee520ed5c906','5c116fe0-8b06-4597-9822-28c8cf5cf9c3','4cf7d99f-4ae9-42e9-9da5-fbdf7fc1356c','76dabda2-c950-4daa-8dcb-2403fd6807ce','58868a61-a532-4804-8ef8-e64cc70be111'], opponents: [[2,1,4,3,6,5,8],[3,4,1,2,7,8,5],[4,3,2,1,8,7,6],[5,6,7,8,1,2,3],[6,8,5,7,3,1,4],[7,5,8,6,2,4,1],[8,7,6,5,4,3,2]] },
  { number: 4, ids: ['f9c92f2f-fc70-4854-ad0f-916fb6bdebdd','37290b22-bdb5-4589-acc9-fb5fb1a603bf','361f9800-2c5f-4264-874f-608b9964e946','aca155bc-0a38-4181-bdb9-ec62224ae9ea','650c67ed-3d67-4580-9fe3-3b092b01486e','efa5966e-4875-4d10-852d-21e84418554c','37e3a516-4947-42a0-bd73-528a4911854a'], opponents: [[2,1,4,3,6,5,8],[3,4,1,2,7,8,5],[4,3,2,1,8,7,6],[5,6,7,8,1,2,3],[6,8,5,7,3,1,4],[7,5,8,6,2,4,1],[8,7,6,5,4,3,2]] }
];
const PLAYOFFS = [
 {stage:'semi_final',matchNumber:1,sourceA:{type:'section_winner',sectionNumber:1},sourceB:{type:'section_winner',sectionNumber:3}},
 {stage:'semi_final',matchNumber:2,sourceA:{type:'section_winner',sectionNumber:2},sourceB:{type:'section_winner',sectionNumber:4}},
 {stage:'final',matchNumber:1,sourceA:{type:'semi_final_winner',matchNumber:1},sourceB:{type:'semi_final_winner',matchNumber:2}}
];

export function buildOfficialLadiesDistrictPairsProposal(teams, competitionType='weekend') {
 const byId = new Map(teams.map(t=>[t.id,t]));
 const missing = OFFICIAL_SECTIONS.flatMap(s=>s.ids).filter(id=>!byId.has(id));
 if (teams.length !== 27 || missing.length) throw new Error(`Official ladies draw requires the verified 27 entered teams. Found ${teams.length} active teams; ${missing.length} official team IDs are missing. No draw was changed.`);
 const sections = OFFICIAL_SECTIONS.map(spec=>{
  const sectionTeams=spec.ids.map(id=>byId.get(id));
  const rounds=spec.opponents.map((opponents,ri)=>{
   const matches=[]; let byeTeam=null; const paired=new Set();
   opponents.forEach((opponent,pos)=>{
    const a=pos+1;
    if(opponent>a || opponent===8){
      if(opponent===8){byeTeam=sectionTeams[pos];return;}
      if(paired.has(a)||paired.has(opponent)) return;
      matches.push({id:`official-s${spec.number}-r${ri+1}-m${matches.length+1}`,matchNumber:matches.length+1,teamAId:sectionTeams[pos].id,teamBId:sectionTeams[opponent-1].id,teamA:sectionTeams[pos],teamB:sectionTeams[opponent-1],type:'round_robin',completed:false});
      paired.add(a);paired.add(opponent);
    }
   });
   return {number:ri+1,type:'round_robin',matches,byeTeam};
  });
  return {number:spec.number,sectionName:`Section ${spec.number}`,teams:sectionTeams,rounds,roundCount:rounds.length,targetSize:sectionTeams.length};
 });
 const sectionalRounds=7, playoffStages=['semi_final','final'];
 return {teamCount:27,competitionType,sectionMode:'multiple',sectionCount:4,recommendedPlan:{id:'official-ladies-district-pairs',status:'proposal',recommended:true,alternative:false,competitionType,sectionMode:'multiple',teamCount:27,sectionCount:4,sectionSizes:[7,6,7,7],sections,sectionalRounds,playoffStages,playoffMatches:PLAYOFFS,totalRounds:9,sameClubPairs:0,schedule:{competitionType,normalSchedule:'Official Ladies District Pairs draw imported for review. Dates and venues are assigned in the Playing Schedule.',overflow:false},rules:{qualifierPerSection:1,repeatOpponents:false,source:'Ladies District Pairs provisional draw PDF'}},alternativePlans:[],plans:[],generatedAt:new Date().toISOString(),source:'official_ladies_district_pairs_pdf'};
}
