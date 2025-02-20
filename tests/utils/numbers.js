require('dotenv').config();
import { Decimal } from 'decimal.js';

import chai from 'chai';
import Numbers from '../../src/utils/Numbers';
import { mochaAsync } from '../utils';

const ERC20TokenAddress = '0x7a7748bd6f9bac76c2f3fcb29723227e3376cbb2';
var contractAddress = '0x420751cdeb28679d8e336f2b4d1fc61df7439b5a';
var userPrivateKey = process.env.TEST_PRIVATE_KEY || '0x7f76de05082c4d578219ca35a905f8debe922f1f00b99315ebf0706afc97f132';

const expect = chai.expect;

context('Numbers', async () => {
    var app;

    it('should get a Fixed Value', mochaAsync(async () => {
        expect(Numbers.toSmartContractDecimals(new Decimal(0.087).plus(0.01), 18)).to.equal("97000000000000000");
        expect(Numbers.toSmartContractDecimals(new Decimal(0.087234523452345).plus(0.01), 18)).to.equal("97234523452345000");
        expect(Numbers.toSmartContractDecimals(new Decimal(0.007234523453345333).plus(0.01), 18)).to.equal("17234523453345333");
        expect(Numbers.fromDecimals("97000000000000000", 18)).to.equal("0.097");
    }));

});
