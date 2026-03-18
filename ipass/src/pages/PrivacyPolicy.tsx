/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Box, Link, Stack, Typography } from '@wso2/oxygen-ui';
import { ArrowLeft } from '@wso2/oxygen-ui-icons-react';
import type { JSX } from 'react';
import { useNavigate } from 'react-router';
import { Link as NavLink } from 'react-router';
import { cookiePolicyUrl, external, loginUrl } from '../paths';

export default function PrivacyPolicy(): JSX.Element {
  const navigate = useNavigate();
  const handleBack = () => (window.history.length > 1 ? navigate(-1) : navigate(loginUrl()));

  return (
    <Box sx={{ position: 'fixed', inset: 0, overflowY: 'auto', zIndex: 1 }}>
      <Link component="button" onClick={handleBack} sx={{ position: 'fixed', top: '5rem', left: '1.5rem', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        <ArrowLeft size={16} />
        Back
      </Link>
      <Box sx={{ maxWidth: 800, mx: 'auto', px: 4, py: 6 }}>
        <Typography variant="h1" gutterBottom>
          WSO2 Integration Platform - Privacy Policy
        </Typography>
        <Link href={external.wso2} target="_blank" rel="noopener noreferrer" color="primary" sx={{ textDecoration: 'underline' }}>
          WSO2 Integration Platform
        </Link>
        <Typography variant="body1" sx={{ mt: 1, mb: 4 }}>
          WSO2 Integration Platform monitors running Micro Integrator instances (Single or Cluster Mode) and facilitates performing various management and administration tasks related to deployed artifacts.
        </Typography>

        <Stack spacing={3}>
          <section>
            <Typography variant="h3" component="h2" gutterBottom>
              Privacy Policy
            </Typography>
            <Typography variant="body1" paragraph>
              This policy describes how WSO2 Integration Platform captures your personal information, the purposes of collection, and information about the retention of your personal information.
            </Typography>
            <Typography variant="body1" paragraph>
              Please note that this policy is for reference only, and is applicable for the software as a product. WSO2 Inc. and its developers have no access to the information held within WSO2 Integration Platform. Please see the Disclaimer section for more
              information
            </Typography>
            <Typography variant="body1">
              Entities, organizations or individuals controlling the use and administration of WSO2 Integration Platform should create their own privacy policies setting out the manner in which data is controlled or processed by the respective entity,
              organization or individual.
            </Typography>
          </section>

          <section>
            <Typography variant="h3" component="h2" gutterBottom>
              What is personal information?
            </Typography>
            <Typography variant="body1" paragraph>
              WSO2 Integration Platform considers anything related to you, and by which you may be identified, as your personal information. This includes, but is not limited to:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: '2rem' }}>
              <li>
                <Typography variant="body1">Your user name (except in cases where the user name created by your employer is under contract)</Typography>
              </li>
              <li>
                <Typography variant="body1">Your date of birth/age</Typography>
              </li>
              <li>
                <Typography variant="body1">IP address used to log in</Typography>
              </li>
              <li>
                <Typography variant="body1">Your device ID if you use a device (e.g., phone or tablet) to log in</Typography>
              </li>
            </ul>
            <Typography variant="body1" paragraph sx={{ mt: 2 }}>
              However, WSO2 Integration Platform also collects the following information that is not considered personal information, but is used only for <strong>statistical</strong> purposes. The reason for this is that this information can not be used to
              track you.
            </Typography>
            <ul style={{ margin: 0, paddingLeft: '2rem' }}>
              <li>
                <Typography variant="body1">City/Country from which you originated the TCP/IP connection</Typography>
              </li>
              <li>
                <Typography variant="body1">Time of the day that you logged in (year, month, week, hour or minute)</Typography>
              </li>
              <li>
                <Typography variant="body1">Type of device that you used to log in (e.g., phone or tablet)</Typography>
              </li>
              <li>
                <Typography variant="body1">Operating system and generic browser information</Typography>
              </li>
            </ul>
          </section>

          <section>
            <Typography variant="h3" component="h2" gutterBottom>
              Collection of personal information
            </Typography>
            <Typography variant="body1" paragraph>
              WSO2 Integration Platform collects your information only to serve your access requirements. For example:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: '2rem' }}>
              <li>
                <Typography variant="body1">WSO2 Integration Platform uses your IP address to detect any suspicious login attempts to your account.</Typography>
              </li>
              <li>
                <Typography variant="body1">WSO2 Integration Platform uses attributes like your first name, last name, etc., to provide a rich and personalized user experience.</Typography>
              </li>
              <li>
                <Typography variant="body1">WSO2 Integration Platform uses your security questions and answers only to allow account recovery.</Typography>
              </li>
            </ul>
          </section>

          <section>
            <Typography variant="h3" component="h2" gutterBottom>
              Tracking Technologies
            </Typography>
            <Typography variant="body1" paragraph>
              WSO2 Integration Platform collects your information by:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: '2rem' }}>
              <li>
                <Typography variant="body1">Collecting information from the user profile page where you enter your personal data.</Typography>
              </li>
              <li>
                <Typography variant="body1">Tracking your IP address with HTTP request, HTTP headers, and TCP/IP.</Typography>
              </li>
              <li>
                <Typography variant="body1">Tracking your geographic information with the IP address.</Typography>
              </li>
              <li>
                <Typography variant="body1">
                  Tracking your login history with browser cookies. Please see our{' '}
                  <Link component={NavLink} to={cookiePolicyUrl()} sx={{ textDecoration: 'underline' }}>
                    cookie policy
                  </Link>{' '}
                  for more information.
                </Typography>
              </li>
            </ul>
          </section>

          <section>
            <Typography variant="h3" component="h2" gutterBottom>
              Use of personal information
            </Typography>
            <Typography variant="body1" paragraph>
              WSO2 Integration Platform will only use your personal information for the purposes for which it was collected (or for a use identified as consistent with that purpose).
            </Typography>
            <Typography variant="body1" paragraph>
              WSO2 Integration Platform uses your personal information only for the following purposes.
            </Typography>
            <ul style={{ margin: 0, paddingLeft: '2rem' }}>
              <li>
                <Typography variant="body1">To provide you with a personalized user experience. WSO2 Integration Platform uses your name and uploaded profile pictures for this purpose.</Typography>
              </li>
              <li>
                <Typography variant="body1" paragraph>
                  To protect your account from unauthorized access or potential hacking attempts. WSO2 Integration Platform uses HTTP or TCP/IP Headers for this purpose.
                </Typography>
                <ul style={{ paddingLeft: '2rem' }}>
                  <li>
                    <Typography variant="body1">This includes:</Typography>
                    <ul style={{ paddingLeft: '2rem' }}>
                      <li>
                        <Typography variant="body1">IP address</Typography>
                      </li>
                      <li>
                        <Typography variant="body1">Browser fingerprinting</Typography>
                      </li>
                      <li>
                        <Typography variant="body1">Cookies</Typography>
                      </li>
                    </ul>
                  </li>
                </ul>
              </li>
              <li>
                <Typography variant="body1" paragraph>
                  Derive statistical data for analytical purposes on system performance improvements. WSO2 IS will not keep any personal information after statistical calculations. Therefore, the statistical report has no means of identifying an individual
                  person.
                </Typography>
                <ul style={{ paddingLeft: '2rem' }}>
                  <li>
                    <Typography variant="body1">WSO2 Integration Platform may use:</Typography>
                    <ul style={{ paddingLeft: '2rem' }}>
                      <li>
                        <Typography variant="body1">IP Address to derive geographic information</Typography>
                      </li>
                      <li>
                        <Typography variant="body1">Browser fingerprinting to determine the browser technology or/and version</Typography>
                      </li>
                    </ul>
                  </li>
                </ul>
              </li>
            </ul>
          </section>

          <section>
            <Typography variant="h3" component="h2" gutterBottom>
              Disclosure of personal information
            </Typography>
            <Typography variant="body1">
              WSO2 Integration Platform only discloses personal information to the relevant applications (also known as &quot;Service Providers&quot;) that are registered with WSO2 Integration Platform. These applications are registered by the identity
              administrator of your entity or organization. Personal information is disclosed only for the purposes for which it was collected (or for a use identified as consistent with that purpose), as controlled by such Service Providers, unless you have
              consented otherwise or where it is required by law.
            </Typography>
          </section>

          <section>
            <Typography variant="h3" component="h2" gutterBottom>
              Legal process
            </Typography>
            <Typography variant="body1">
              Please note that the organization, entity or individual running WSO2 Integration Platform may be compelled to disclose your personal information with or without your consent when it is required by law following due and lawful process.
            </Typography>
          </section>

          <section>
            <Typography variant="h3" component="h2" gutterBottom>
              Storage of personal information
            </Typography>

            <Typography variant="h4" component="h3" gutterBottom>
              Where your personal information is stored
            </Typography>
            <Typography variant="body1" paragraph>
              WSO2 Integration Platform stores your personal information in secured databases. WSO2 Integration Platform exercises proper industry accepted security measures to protect the database where your personal information is held. WSO2 Integration
              Platform as a product does not transfer or share your data with any third parties or locations.
            </Typography>
            <Typography variant="body1" paragraph>
              WSO2 Integration Platform may use encryption to keep your personal data with an added level of security.
            </Typography>

            <Typography variant="h4" component="h3" gutterBottom>
              How long your personal information is retained
            </Typography>
            <Typography variant="body1" paragraph>
              WSO2 Integration Platform retains your personal data as long as you are an active user of our system. You can update your personal data at any time using the given self-care user portals.
            </Typography>
            <Typography variant="body1" paragraph>
              WSO2 Integration Platform may keep hashed secrets to provide you with an added level of security. This includes:
            </Typography>
            <ul style={{ margin: 0, paddingLeft: '2rem' }}>
              <li>
                <Typography variant="body1">Current password</Typography>
              </li>
              <li>
                <Typography variant="body1">Previously used passwords</Typography>
              </li>
            </ul>

            <Typography variant="h4" component="h3" gutterBottom sx={{ mt: 2 }}>
              How to request removal of your personal information
            </Typography>
            <Typography variant="body1" paragraph>
              You can request the administrator to delete your account. The administrator is the administrator of the organization you are registered under, or the super-administrator if you do not use the organization feature.
            </Typography>
            <Typography variant="body1">Additionally, you can request to anonymize all traces of your activities that WSO2 Integration Platform may have retained in logs, databases or analytical storage.</Typography>
          </section>

          <section>
            <Typography variant="h3" component="h2" gutterBottom>
              More information
            </Typography>

            <Typography variant="h4" component="h3" gutterBottom>
              Changes to this policy
            </Typography>
            <Typography variant="body1" paragraph>
              Upgraded versions of WSO2 Integration Platform may contain changes to this policy and revisions to this policy will be packaged within such upgrades. Such changes would only apply to users who choose to use upgraded versions.
            </Typography>
            <Typography variant="body1" paragraph>
              The organization running WSO2 Integration Platform may revise the Privacy Policy from time to time. You can find the most recent governing policy with the respective link provided by the organization running WSO2 Integration Platform. The
              organization will notify any changes to the privacy policy over our official public channels.
            </Typography>

            <Typography variant="h4" component="h3" gutterBottom>
              Your choices
            </Typography>
            <Typography variant="body1" paragraph>
              If you already have a user account within WSO2 Integration Platform, you have the right to deactivate your account if you find that this privacy policy is unacceptable to you.
            </Typography>
            <Typography variant="body1" paragraph>
              If you do not have an account and you do not agree with our privacy policy, you can choose not to create one.
            </Typography>

            <Typography variant="h4" component="h3" gutterBottom>
              Contact us
            </Typography>
            <Typography variant="body1" paragraph>
              Please contact WSO2 if you have any questions or concerns regarding this privacy policy.
            </Typography>
            <Link href={external.wso2Contact} target="_blank" rel="noopener noreferrer" color="primary" sx={{ textDecoration: 'underline' }}>
              {external.wso2Contact}
            </Link>
          </section>

          <section>
            <Typography variant="h3" component="h2" gutterBottom>
              Disclaimer
            </Typography>
            <ol style={{ margin: 0, paddingLeft: '2rem' }}>
              <li>
                <Typography variant="body1" paragraph>
                  WSO2, its employees, partners, and affiliates do not have access to and do not require, store, process or control any of the data, including personal data contained in WSO2 Integration Platform. All data, including personal data is controlled
                  and processed by the entity or individual running WSO2 Integration Platform. WSO2, its employees partners and affiliates are not a data processor or a data controller within the meaning of any data privacy regulations. WSO2 does not provide
                  any warranties or undertake any responsibility or liability in connection with the lawfulness or the manner and purposes for which WSO2 Integration Platform is used by such entities or persons.
                </Typography>
              </li>
              <li>
                <Typography variant="body1">
                  This privacy policy is for the informational purposes of the entity or persons running WSO2 IS and sets out the processes and functionality contained within WSO2 Integration Platform regarding personal data protection. It is the
                  responsibility of entities and persons running WSO2 Integration Platform to create and administer its own rules and processes governing users&apos; personal data, and such rules and processes may change the use, storage and disclosure
                  policies contained herein. Therefore users should consult the entity or persons running WSO2 Integration Platform for its own privacy policy for details governing users&apos; personal data.
                </Typography>
              </li>
            </ol>
          </section>
        </Stack>
      </Box>
    </Box>
  );
}
