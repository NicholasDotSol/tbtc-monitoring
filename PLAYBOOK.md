# Stuck in AWAITING_SIGNER_SETUP

User abandonded keep. Keep will stay in limbo until someone terminates. In this
case, the person that opened will get a small (sub-dollar) amount back, and it
will be marked terminated (which means no stakedrop rewards).  Alternatively,
you can call `retreiveSignerPubKey` within 3 hours and then
`notifyFundingTimedOut` 3 hours later (funding proof timeout). This will free
the bond and close the keep, in which case rewards will still be given.

This can all be done via etherscan with any wallet visiting the cloneAddress.
