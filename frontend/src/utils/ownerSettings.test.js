import {ownerSettingsPayload} from './ownerSettings';
test('billing save excludes unrelated blank capital and personal fields',()=>{
 expect(ownerSettingsPayload({usd_lbp_rate:95000,vat_rate:0,vat_enabled:1,invoice_prefix:'PS',capital_lbp:null,full_name:'Owner',password:''},'billing')).toEqual({usd_lbp_rate:95000,vat_rate:0,vat_enabled:1,invoice_prefix:'PS'});
});
test('business zero capital is retained, an empty optional capital is omitted',()=>{
 expect(ownerSettingsPayload({capital_lbp:0,business_name:'QA',usd_lbp_rate:95000},'business')).toEqual({business_name:'QA',capital_lbp:0});
 expect(ownerSettingsPayload({capital_lbp:'',business_name:'QA'},'business')).toEqual({business_name:'QA'});
});
